// Smart Match Links für Swiss Cup Smart Brackets
// Speziell für .smart-match-absolute Elemente (nicht Prognose, nicht Freilos)

let smartLinksInitialized = false;
let smartLinksObserver = null;

function initializeSmartMatchLinks() {
    // Verhindere mehrfache Initialisierung
    if (smartLinksInitialized) {
        console.log('🔗 Smart match links bereits initialisiert, überspringe...');
        return;
    }
    
    console.log('🔗 Initializing smart match links...');
    
    // Entferne alle existierenden Smart Match-Links
    removeSmartMatchLinks();
    
    // Finde alle Smart Match-Container (.smart-match-absolute für absolut positionierte Matches)
    const smartMatches = document.querySelectorAll('.smart-match-absolute');
    let linkCount = 0;
    
    smartMatches.forEach(matchElement => {
        const numericGameId = getNumericGameIdFromSmartMatch(matchElement);
        
        // Prüfe ob Smart Match-Link erstellt werden soll
        if (shouldCreateSmartMatchLink(matchElement, numericGameId)) {
            createSmartMatchLink(matchElement, numericGameId);
            linkCount++;
        }
    });
    
    console.log(`✅ Created ${linkCount} smart match links`);
    smartLinksInitialized = true;
}

// Reset-Funktion für neues Bracket
function resetSmartMatchLinks() {
    console.log('🔄 Resetting smart match links...');
    smartLinksInitialized = false;
    removeSmartMatchLinks();
    
    // Observer stoppen falls aktiv
    if (smartLinksObserver) {
        smartLinksObserver.disconnect();
        smartLinksObserver = null;
    }
}

function getNumericGameIdFromSmartMatch(matchElement) {
    // Versuche numericGameId aus data-Attributen zu holen
    const dataGameId = matchElement.getAttribute('data-game-id');
    if (dataGameId && dataGameId !== '' && dataGameId !== 'null' && dataGameId !== 'undefined') {
        return dataGameId;
    }
    
    // Alternative: aus dem title-Attribut extrahieren
    const title = matchElement.getAttribute('title');
    if (title) {
        // Suche nach "numericGameId: 123"
        const numericMatch = title.match(/numericGameId:\s*(\d+)/);
        if (numericMatch) return numericMatch[1];
        
        // Fallback: "Game: 123"
        const gameMatch = title.match(/Game:\s*(\d+)/);
        if (gameMatch) return gameMatch[1];
    }
    
    return null;
}

function shouldCreateSmartMatchLink(matchElement, numericGameId) {
    // Debug-Ausgabe nur bei tatsächlicher Verarbeitung
    const team1Text = getTeamText(matchElement, 0);
    const team2Text = getTeamText(matchElement, 1);
    
    // Reduziere Debug-Output
    if (numericGameId && !isSmartPrognoseMatch(matchElement) && !isSmartFreilosMatch(matchElement) && !isSmartTBDMatch(matchElement)) {
        console.log(`🔍 Checking smart match: team1="${team1Text}", team2="${team2Text}", gameId="${numericGameId}"`);
    }
    
    // Kein Link ohne numericGameId
    if (!numericGameId) {
        return false;
    }
    
    // Kein Link für Prognose-Spiele
    if (isSmartPrognoseMatch(matchElement)) {
        return false;
    }
    
    // Kein Link für Freilos-Spiele
    if (isSmartFreilosMatch(matchElement)) {
        return false;
    }
    
    // Kein Link für TBD-Spiele
    if (isSmartTBDMatch(matchElement)) {
        return false;
    }
    
    console.log(`✅ Creating link for game ID: ${numericGameId}`);
    return true;
}

function getTeamText(matchElement, teamIndex) {
    const teams = matchElement.querySelectorAll('.team');
    if (teams[teamIndex]) {
        const teamName = teams[teamIndex].querySelector('.team-name');
        return teamName ? teamName.textContent.trim() : '';
    }
    return '';
}

function isSmartPrognoseMatch(matchElement) {
    // Prüfe ob beide Teams TBD sind (typisch für Prognose-Spiele)
    const team1Text = getTeamText(matchElement, 0);
    const team2Text = getTeamText(matchElement, 1);
    
    // Beide Teams sind TBD
    if (team1Text === 'TBD' && team2Text === 'TBD') {
        return true;
    }
    
    // Ein Team ist TBD und das andere ist nicht Freilos (typisch für Prognose)
    if ((team1Text === 'TBD' && team2Text !== 'Freilos') || 
        (team2Text === 'TBD' && team1Text !== 'Freilos')) {
        return true;
    }
    
    // Team-Namen enthalten Prognose-Pattern wie "Team1 / Team2"
    if (team1Text.includes(' / ') || team2Text.includes(' / ')) {
        return true;
    }
    
    return false;
}

function isSmartFreilosMatch(matchElement) {
    // Prüfe Team-Namen auf "Freilos"
    const team1Text = getTeamText(matchElement, 0);
    const team2Text = getTeamText(matchElement, 1);
    
    const team1IsFreilos = team1Text.toLowerCase() === 'freilos';
    const team2IsFreilos = team2Text.toLowerCase() === 'freilos';
    
    return team1IsFreilos || team2IsFreilos;
}

function isSmartTBDMatch(matchElement) {
    // Prüfe ob alle Teams TBD-Klasse haben
    const teams = matchElement.querySelectorAll('.team');
    if (teams.length === 0) return true;
    
    let tbdCount = 0;
    teams.forEach(team => {
        if (team.classList.contains('tbd')) {
            tbdCount++;
        }
    });
    
    return tbdCount === teams.length;
}

function createSmartMatchLink(matchElement, numericGameId) {
    // Entferne existierenden Link falls vorhanden
    const existingLink = matchElement.querySelector('.smart-match-link');
    if (existingLink) {
        existingLink.remove();
    }
    
    // Erstelle neuen Link
    const link = document.createElement('a');
    link.className = 'smart-match-link';
    link.href = `https://www.swissunihockey.ch/de/game-detail?game_id=${numericGameId}`;
    link.target = '_blank';
    link.title = `Spiel-Details ansehen (Game ID: ${numericGameId})`;
    link.setAttribute('data-game-id', numericGameId);
    
    // Link-Content (leer für CSS styling)
    link.innerHTML = '';
    
    // Event-Handler für Link
    link.addEventListener('click', function(e) {
        e.stopPropagation();
        console.log(`🔗 Opening smart game details for game ID: ${numericGameId}`);
    });
    
    // Link zum Match hinzufügen
    matchElement.appendChild(link);
    
    // Stelle sicher dass Match relative Positionierung hat
    if (getComputedStyle(matchElement).position === 'static') {
        matchElement.style.position = 'relative';
    }
}

function removeSmartMatchLinks() {
    // Entferne alle existierenden Smart Match-Links
    const existingLinks = document.querySelectorAll('.smart-match-link');
    existingLinks.forEach(link => {
        link.remove();
    });
}

function refreshSmartMatchLinks() {
    console.log('🔄 Refreshing smart match links...');
    resetSmartMatchLinks();
    setTimeout(initializeSmartMatchLinks, 100);
}

function debugSmartMatchLinks() {
    console.log('\n🔍 DEBUG: Smart Match Links');
    const smartMatches = document.querySelectorAll('.smart-match-absolute');
    console.log(`Found ${smartMatches.length} smart match elements`);
    
    smartMatches.forEach((match, index) => {
        const gameId = getNumericGameIdFromSmartMatch(match);
        const title = match.getAttribute('title');
        const dataGameId = match.getAttribute('data-game-id');
        const team1Text = getTeamText(match, 0);
        const team2Text = getTeamText(match, 1);
        const isFreilos = isSmartFreilosMatch(match);
        const isTBD = isSmartTBDMatch(match);
        const isPrognose = isSmartPrognoseMatch(match);
        
        console.log(`${index + 1}. Smart Match:`, {
            element: match.className,
            team1: team1Text,
            team2: team2Text,
            gameId: gameId,
            dataGameId: dataGameId,
            title: title,
            isFreilos: isFreilos,
            isTBD: isTBD,
            isPrognose: isPrognose,
            shouldCreateLink: shouldCreateSmartMatchLink(match, gameId)
        });
    });
}

// Optimierte Auto-Initialisierung - nur bei echten Bracket-Änderungen
function setupSmartLinksObserver() {
    // Verhindere mehrfache Observer
    if (smartLinksObserver) {
        return;
    }
    
    smartLinksObserver = new MutationObserver(function(mutations) {
        let shouldReinitialize = false;
        
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                // Nur bei echten Bracket-Änderungen reagieren
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.classList) {
                        if (node.classList.contains('smart-bracket') ||
                            node.classList.contains('smart-match-absolute')) {
                            shouldReinitialize = true;
                        }
                    }
                });
            }
        });
        
        // Debounced Reinitialisierung
        if (shouldReinitialize && !smartLinksInitialized) {
            setTimeout(() => {
                if (!smartLinksInitialized) {
                    initializeSmartMatchLinks();
                }
            }, 500);
        }
    });
    
    // Beobachte nur den Bracket-Container
    const bracketContainer = document.querySelector('.bracket-container');
    if (bracketContainer) {
        smartLinksObserver.observe(bracketContainer, { 
            childList: true, 
            subtree: true,
            attributes: false,
            characterData: false
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    setupSmartLinksObserver();
});

// Keyboard shortcuts für Debug
document.addEventListener('keydown', function(e) {
    if (e.key === 'l' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        debugSmartMatchLinks();
    }
    
    if (e.key === 'Escape') {
        debugSmartMatchLinks();
    }
});

// Exportiere Funktionen für manuellen Aufruf
window.initializeSmartMatchLinks = initializeSmartMatchLinks;
window.refreshSmartMatchLinks = refreshSmartMatchLinks;
window.removeSmartMatchLinks = removeSmartMatchLinks;
window.resetSmartMatchLinks = resetSmartMatchLinks;
window.debugSmartMatchLinks = debugSmartMatchLinks;