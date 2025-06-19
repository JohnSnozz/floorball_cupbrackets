// Smart Match Links für Swiss Cup Smart Brackets
// Speziell für .smart-match Elemente

function initializeSmartMatchLinks() {
    console.log('🔗 Initializing smart match links...');
    
    // Entferne alle existierenden Smart Match-Links
    removeSmartMatchLinks();
    
    // Finde alle Smart Match-Container
    const smartMatches = document.querySelectorAll('.smart-match');
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
}

function getNumericGameIdFromSmartMatch(matchElement) {
    // Versuche numericGameId aus data-Attributen zu holen
    const dataGameId = matchElement.getAttribute('data-game-id');
    if (dataGameId && dataGameId !== '') {
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
    // Debug-Ausgabe
    const title = matchElement.getAttribute('title');
    console.log(`🔍 Checking smart match: title="${title}", gameId="${numericGameId}"`);
    
    // Kein Link ohne numericGameId
    if (!numericGameId) {
        console.log('❌ No numericGameId found');
        return false;
    }
    
    // Kein Link für Freilos-Spiele
    if (isSmartFreilosMatch(matchElement)) {
        console.log('❌ Skipping Freilos match');
        return false;
    }
    
    // Kein Link für TBD-Spiele (noch nicht angesetzt)
    if (isSmartTBDMatch(matchElement)) {
        console.log('❌ Skipping TBD match');
        return false;
    }
    
    console.log(`✅ Creating link for game ID: ${numericGameId}`);
    return true;
}

function isSmartFreilosMatch(matchElement) {
    // Prüfe Team-Namen auf "Freilos"
    const teamNames = matchElement.querySelectorAll('.team-name');
    for (let teamName of teamNames) {
        const text = teamName.textContent.trim().toLowerCase();
        if (text === 'freilos') {
            return true;
        }
    }
    
    return false;
}

function isSmartTBDMatch(matchElement) {
    // Prüfe ob alle Teams TBD sind
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
    
    // Event-Handler für Link
    link.addEventListener('click', function(e) {
        e.stopPropagation();
        console.log(`🔗 Opening smart game details for game ID: ${numericGameId}`);
    });
    
    // Link zum Match hinzufügen
    matchElement.appendChild(link);
    matchElement.style.position = 'relative'; // Für absolute Positionierung des Links
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
    removeSmartMatchLinks();
    setTimeout(initializeSmartMatchLinks, 100);
}

function debugSmartMatchLinks() {
    console.log('\n🔍 DEBUG: Smart Match Links');
    const smartMatches = document.querySelectorAll('.smart-match');
    console.log(`Found ${smartMatches.length} smart match elements`);
    
    smartMatches.forEach((match, index) => {
        const gameId = getNumericGameIdFromSmartMatch(match);
        const title = match.getAttribute('title');
        const dataGameId = match.getAttribute('data-game-id');
        const isFreilos = isSmartFreilosMatch(match);
        const isTBD = isSmartTBDMatch(match);
        
        console.log(`${index + 1}. Smart Match:`, {
            element: match.className,
            gameId: gameId,
            dataGameId: dataGameId,
            title: title,
            isFreilos: isFreilos,
            isTBD: isTBD,
            shouldCreateLink: shouldCreateSmartMatchLink(match, gameId)
        });
    });
}

// Auto-Initialisierung nach Smart Bracket-Rendering
document.addEventListener('DOMContentLoaded', function() {
    // Observer für Smart Bracket-Änderungen
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && 
                mutation.target.classList && 
                (mutation.target.classList.contains('smart-bracket') ||
                 mutation.target.classList.contains('bracket-container'))) {
                setTimeout(initializeSmartMatchLinks, 300);
            }
        });
    });
    
    // Beobachte Bracket-Container
    const bracketContainer = document.querySelector('.bracket-container');
    if (bracketContainer) {
        observer.observe(bracketContainer, { childList: true, subtree: true });
    }
});

// Exportiere Funktionen für manuellen Aufruf
window.initializeSmartMatchLinks = initializeSmartMatchLinks;
window.refreshSmartMatchLinks = refreshSmartMatchLinks;
window.removeSmartMatchLinks = removeSmartMatchLinks;
window.debugSmartMatchLinks = debugSmartMatchLinks;