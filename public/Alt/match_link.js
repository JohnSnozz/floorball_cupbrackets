// Match Links für Swiss Cup Brackets
// Erstellt Links zu den Spiel-Details auf swissunihockey.ch

function initializeMatchLinks() {
    console.log('🔗 Initializing match links...');
    
    // Entferne alle existierenden Match-Links
    removeMatchLinks();
    
    // Finde alle Match-Container
    const matches = document.querySelectorAll('.match');
    let linkCount = 0;
    
    matches.forEach(matchElement => {
        const numericGameId = getNumericGameIdFromMatch(matchElement);
        
        // Prüfe ob Match-Link erstellt werden soll
        if (shouldCreateMatchLink(matchElement, numericGameId)) {
            createMatchLink(matchElement, numericGameId);
            linkCount++;
        }
    });
    
    console.log(`✅ Created ${linkCount} match links`);
}

function getNumericGameIdFromMatch(matchElement) {
    // Versuche numericGameId aus data-Attributen zu holen
    const dataGameId = matchElement.getAttribute('data-game-id');
    if (dataGameId) return dataGameId;
    
    // Alternative: aus dem title-Attribut extrahieren
    const title = matchElement.getAttribute('title');
    if (title) {
        const match = title.match(/Game:\s*(\d+)/);
        if (match) return match[1];
    }
    
    return null;
}

function shouldCreateMatchLink(matchElement, numericGameId) {
    // Kein Link ohne numericGameId
    if (!numericGameId) {
        return false;
    }
    
    // Kein Link für Freilos-Spiele
    if (isFreilosMatch(matchElement)) {
        return false;
    }
    
    // Kein Link für TBD-Spiele (noch nicht angesetzt)
    if (isTBDMatch(matchElement)) {
        return false;
    }
    
    return true;
}

function isFreilosMatch(matchElement) {
    // Prüfe ob Match Freilos enthält
    if (matchElement.classList.contains('freilos')) {
        return true;
    }
    
    // Prüfe Team-Namen auf "Freilos"
    const teamNames = matchElement.querySelectorAll('.team-name');
    for (let teamName of teamNames) {
        if (teamName.textContent.trim().toLowerCase() === 'freilos') {
            return true;
        }
    }
    
    return false;
}

function isTBDMatch(matchElement) {
    // Prüfe ob alle Teams TBD sind
    const teams = matchElement.querySelectorAll('.team');
    let tbdCount = 0;
    
    teams.forEach(team => {
        if (team.classList.contains('tbd')) {
            tbdCount++;
        }
    });
    
    return tbdCount === teams.length;
}

function createMatchLink(matchElement, numericGameId) {
    // Entferne existierenden Link falls vorhanden
    const existingLink = matchElement.querySelector('.match-link');
    if (existingLink) {
        existingLink.remove();
    }
    
    // Erstelle neuen Link
    const link = document.createElement('a');
    link.className = 'match-link';
    link.href = `https://www.swissunihockey.ch/de/game-detail?game_id=${numericGameId}`;
    link.target = '_blank';
    link.title = 'Spiel-Details ansehen';
    link.setAttribute('data-game-id', numericGameId);
    
    // Link-Icon (optional - könnte auch CSS content sein)
    link.innerHTML = '';
    
    // Event-Handler für Link
    link.addEventListener('click', function(e) {
        e.stopPropagation();
        console.log(`🔗 Opening game details for game ID: ${numericGameId}`);
    });
    
    // Link zum Match hinzufügen
    matchElement.appendChild(link);
    matchElement.style.position = 'relative'; // Für absolute Positionierung des Links
}

function removeMatchLinks() {
    // Entferne alle existierenden Match-Links
    const existingLinks = document.querySelectorAll('.match-link');
    existingLinks.forEach(link => {
        link.remove();
    });
}

function refreshMatchLinks() {
    console.log('🔄 Refreshing match links...');
    removeMatchLinks();
    setTimeout(initializeMatchLinks, 100);
}

// Auto-Initialisierung nach Bracket-Rendering
document.addEventListener('DOMContentLoaded', function() {
    // Observer für Bracket-Änderungen
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && 
                mutation.target.classList && 
                (mutation.target.classList.contains('bracket') || 
                 mutation.target.classList.contains('bracket-container'))) {
                setTimeout(initializeMatchLinks, 300);
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
window.initializeMatchLinks = initializeMatchLinks;
window.refreshMatchLinks = refreshMatchLinks;
window.removeMatchLinks = removeMatchLinks;