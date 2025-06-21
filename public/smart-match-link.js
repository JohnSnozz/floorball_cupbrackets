// Smart Match Links für Swiss Cup Smart Brackets
// Erweitert um Status-basierte Farben (gespielt, geplant, heute, morgen)

let smartLinksInitialized = false;
let smartLinksObserver = null;

function initializeSmartMatchLinks() {
    // Verhindere mehrfache Initialisierung
    if (smartLinksInitialized) {
        console.log('🔗 Smart match links bereits initialisiert, überspringe...');
        return;
    }
    
    console.log('🔗 Initializing enhanced smart match links...');
    
    // Entferne alle existierenden Smart Match-Links
    removeSmartMatchLinks();
    
    // Finde alle Smart Match-Container (.smart-match-absolute für absolut positionierte Matches)
    const smartMatches = document.querySelectorAll('.smart-match-absolute');
    let linkCount = 0;
    
    smartMatches.forEach(matchElement => {
        const matchData = getMatchDataFromSmartMatch(matchElement);
        
        // Prüfe ob Smart Match-Link erstellt werden soll
        if (shouldCreateSmartMatchLink(matchElement, matchData)) {
            createSmartMatchLink(matchElement, matchData);
            linkCount++;
        }
    });
    
    console.log(`✅ Created ${linkCount} enhanced smart match links`);
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

function getMatchDataFromSmartMatch(matchElement) {
    const numericGameId = getNumericGameIdFromSmartMatch(matchElement);
    const gameData = getGameDataFromCurrentGames(matchElement);
    
    // Fallback: Parse Resultate direkt aus DOM wenn keine gameData
    const domResult = extractResultFromDOM(matchElement);
    
    return {
        gameId: gameData?.gameId || null,
        numericGameId: numericGameId,
        gameDate: gameData?.gameDate || gameData?.date || null,
        gameTime: gameData?.gameTime || gameData?.time || null,
        result: gameData?.result || domResult || null,
        source: gameData?.source || null,
        team1: gameData?.team1 || getTeamText(matchElement, 0),
        team2: gameData?.team2 || getTeamText(matchElement, 1)
    };
}

function extractResultFromDOM(matchElement) {
    // Prüfe ob das Match bereits ein Resultat im DOM hat
    const scoreElements = matchElement.querySelectorAll('.team-score');
    
    if (scoreElements.length === 2) {
        const score1 = scoreElements[0].textContent.trim();
        const score2 = scoreElements[1].textContent.trim();
        
        // Nur wenn beide Scores numerisch sind
        if (score1.match(/^\d+$/) && score2.match(/^\d+$/)) {
            const result = `${score1}:${score2}`;
            console.log(`   📊 Extracted result from DOM: ${result}`);
            return result;
        }
    }
    
    // Prüfe Winner-Klassen als Indikator für gespieltes Spiel
    const winnerTeams = matchElement.querySelectorAll('.team.winner');
    if (winnerTeams.length > 0) {
        console.log(`   🏆 Found winner class in DOM - match is played`);
        return 'PLAYED'; // Einfacher Indikator dass gespielt wurde
    }
    
    return null;
}

function getGameDataFromCurrentGames(matchElement) {
    // Versuche Spiel-Daten aus dem globalen currentGames Array zu holen
    if (typeof window !== 'undefined' && window.currentGames) {
        const bracketSort = matchElement.getAttribute('data-bracket-sort');
        const gameId = matchElement.getAttribute('data-game-id');
        const team1 = getTeamText(matchElement, 0);
        const team2 = getTeamText(matchElement, 1);
        
        console.log(`🔍 Looking for game data - bracketSort: ${bracketSort}, gameId: ${gameId}, teams: "${team1}" vs "${team2}"`);
        
        // Suche nach bracketSortOrder
        let game = null;
        
        if (bracketSort) {
            game = window.currentGames.find(g => 
                g.bracketSortOrder === bracketSort || 
                g.bracketSortOrder === parseInt(bracketSort)
            );
            if (game) {
                console.log(`   ✅ Found by bracketSort: ${game.team1} vs ${game.team2}, gameId: ${game.gameId}, result: ${game.result}, date: ${game.gameDate || game.date}`);
            }
        }
        
        if (!game && gameId) {
            game = window.currentGames.find(g => 
                g.numericGameId === gameId || 
                g.gameId === gameId
            );
            if (game) {
                console.log(`   ✅ Found by gameId: ${game.team1} vs ${game.team2}, gameId: ${game.gameId}, result: ${game.result}, date: ${game.gameDate || game.date}`);
            }
        }
        
        if (!game && team1 && team2 && team1 !== 'TBD' && team2 !== 'TBD' && !isFreilos(team1) && !isFreilos(team2)) {
            // Fallback: Suche nach Team-Namen
            game = window.currentGames.find(g => 
                (g.team1 === team1 && g.team2 === team2) ||
                (g.team1 === team2 && g.team2 === team1)
            );
            if (game) {
                console.log(`   ✅ Found by team names: ${game.team1} vs ${game.team2}, gameId: ${game.gameId}, result: ${game.result}, date: ${game.gameDate || game.date}`);
            }
        }
        
        if (!game) {
            console.log(`   ❌ No game data found in currentGames`);
        }
        
        return game;
    }
    
    console.log(`   ❌ currentGames not available`);
    return null;
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

function shouldCreateSmartMatchLink(matchElement, matchData) {
    const team1Text = getTeamText(matchElement, 0);
    const team2Text = getTeamText(matchElement, 1);
    
    console.log(`🔍 Checking match: "${team1Text}" vs "${team2Text}"`);
    console.log(`   NumericGameID: ${matchData.numericGameId || 'none'}`);
    
    // Kein Link für Freilos-Spiele (ein oder beide Teams sind Freilos)
    if (isSmartFreilosMatch(matchElement)) {
        console.log(`   ❌ Skipping: Freilos game`);
        return false;
    }
    
    // Kein Link für Prognose-Spiele (TBD vs TBD oder Team1/Team2 Pattern)
    if (isSmartPrognoseMatch(matchElement)) {
        console.log(`   ❌ Skipping: Prognose game`);
        return false;
    }
    
    // Link für alle Spiele mit numericGameId oder erkennbaren Teams
    if (matchData.numericGameId) {
        console.log(`   ✅ Creating link: Has numericGameId (${matchData.numericGameId})`);
        return true;
    }
    
    // Auch Links für Spiele ohne numericGameId aber mit echten Teams erstellen
    if (team1Text && team2Text && 
        team1Text !== 'TBD' && team2Text !== 'TBD' &&
        !isFreilos(team1Text) && !isFreilos(team2Text)) {
        console.log(`   ✅ Creating link: Real teams without numericGameId`);
        return true;
    }
    
    console.log(`   ❌ Skipping: No valid criteria met`);
    return false;
}

function determineMatchStatus(matchData) {
    console.log(`🎯 Determining status for match - result: "${matchData.result}", gameDate: "${matchData.gameDate}"`);
    
    // 1. Prüfe ob gespielt (hat Resultat und ist nicht TBD oder leer)
    if (matchData.result && 
        matchData.result.trim() !== '' && 
        matchData.result.toLowerCase() !== 'tbd') {
        
        // Erweiterte Resultat-Erkennung
        if (matchData.result.match(/^\d+$/) ||                    // Einzelne Zahl wie "19"
            matchData.result.match(/\d+[\s\-:]+\d+/) ||          // Score-Pattern wie "3:1" oder "2 - 4"
            matchData.result.toLowerCase() === 'played' ||        // Explizit "PLAYED"
            matchData.result.match(/\d+/) ||                     // Irgendwelche Zahlen im Resultat
            matchData.result.length > 2) {                       // Längere Resultate
            
            console.log(`   ✅ Status: PLAYED (has result: ${matchData.result})`);
            return 'played';
        }
    }
    
    // 2. Prüfe Datum falls verfügbar
    if (matchData.gameDate && matchData.gameDate.trim() !== '') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Parse gameDate (erwarte DD.MM.YYYY, YYYY-MM-DD oder ISO)
        const gameDate = parseGameDate(matchData.gameDate);
        
        if (gameDate) {
            gameDate.setHours(0, 0, 0, 0);
            
            if (gameDate.getTime() === today.getTime()) {
                console.log(`   ✅ Status: TODAY (${matchData.gameDate})`);
                return 'today';
            } else if (gameDate.getTime() === tomorrow.getTime()) {
                console.log(`   ✅ Status: TOMORROW (${matchData.gameDate})`);
                return 'tomorrow';
            } else if (gameDate.getTime() < today.getTime()) {
                // Vergangenes Datum ohne Resultat -> wahrscheinlich gespielt
                console.log(`   ✅ Status: PLAYED (past date: ${matchData.gameDate})`);
                return 'played';
            }
        }
    }
    
    // 3. Default: Geplant (nicht gespielt)
    console.log(`   ✅ Status: SCHEDULED (default)`);
    return 'scheduled';
}

function parseGameDate(dateString) {
    if (!dateString || dateString.trim() === '') {
        return null;
    }
    
    // Format DD.MM.YYYY
    const ddmmyyyyMatch = dateString.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (ddmmyyyyMatch) {
        const day = parseInt(ddmmyyyyMatch[1]);
        const month = parseInt(ddmmyyyyMatch[2]) - 1;
        const year = parseInt(ddmmyyyyMatch[3]);
        return new Date(year, month, day);
    }
    
    // Format YYYY-MM-DD
    const yyyymmddMatch = dateString.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (yyyymmddMatch) {
        const year = parseInt(yyyymmddMatch[1]);
        const month = parseInt(yyyymmddMatch[2]) - 1;
        const day = parseInt(yyyymmddMatch[3]);
        return new Date(year, month, day);
    }
    
    // ISO Format
    try {
        const parsed = new Date(dateString);
        if (!isNaN(parsed.getTime())) {
            return parsed;
        }
    } catch (e) {
        // Ignoriere Parse-Fehler
    }
    
    return null;
}

function isFreilos(teamName) {
    return (teamName || '').toLowerCase().trim() === 'freilos';
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
    const team1Text = getTeamText(matchElement, 0);
    const team2Text = getTeamText(matchElement, 1);
    
    // Team-Namen enthalten Prognose-Pattern wie "Team1 / Team2"
    if (team1Text.includes(' / ') || team2Text.includes(' / ')) {
        console.log(`   🔮 Detected prognose pattern: "${team1Text}" vs "${team2Text}"`);
        return true;
    }
    
    // Beide Teams sind TBD
    if (team1Text === 'TBD' && team2Text === 'TBD') {
        console.log(`   🔮 Both teams TBD: "${team1Text}" vs "${team2Text}"`);
        return true;
    }
    
    return false;
}

function isSmartFreilosMatch(matchElement) {
    // Prüfe Team-Namen auf "Freilos"
    const team1Text = getTeamText(matchElement, 0);
    const team2Text = getTeamText(matchElement, 1);
    
    const team1IsFreilos = isFreilos(team1Text);
    const team2IsFreilos = isFreilos(team2Text);
    
    return team1IsFreilos || team2IsFreilos;
}

function createSmartMatchLink(matchElement, matchData) {
    console.log(`🔗 Creating link for match: ${matchData.team1} vs ${matchData.team2}`);
    
    // Entferne existierenden Link falls vorhanden
    const existingLink = matchElement.querySelector('.smart-match-link');
    if (existingLink) {
        console.log(`   🗑️ Removing existing link`);
        existingLink.remove();
    }
    
    // Bestimme Status und entsprechende CSS-Klasse
    const status = determineMatchStatus(matchData);
    const statusClass = status; // 'played', 'scheduled', 'today', 'tomorrow'
    
    console.log(`   📊 Status determined: ${status}`);
    
    // Erstelle neuen Link
    const link = document.createElement('a');
    link.className = `smart-match-link ${statusClass}`;
    
    // Link-URL setzen
    if (matchData.numericGameId) {
        link.href = `https://www.swissunihockey.ch/de/game-detail?game_id=${matchData.numericGameId}`;
        link.target = '_blank';
        console.log(`   🔗 Link href set to: ${link.href}`);
    } else {
        link.href = '#';
        link.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🔗 No numeric Game ID available - link disabled');
        });
        console.log(`   🔗 Link href set to # (no numericGameId)`);
    }
    
    // Titel mit Status-Info
    const statusText = {
        'played': 'Gespielt',
        'scheduled': 'Geplant',
        'today': 'HEUTE',
        'tomorrow': 'MORGEN'
    };
    
    const titleText = matchData.numericGameId 
        ? `${statusText[status]} - Spiel-Details ansehen (Game ID: ${matchData.numericGameId})`
        : `${statusText[status]} - ${matchData.team1} vs ${matchData.team2}`;
    
    link.title = titleText;
    
    // Data-Attribute für Debug und Styling
    if (matchData.numericGameId) {
        link.setAttribute('data-game-id', matchData.numericGameId);
    }
    if (matchData.gameId) {
        link.setAttribute('data-full-game-id', matchData.gameId);
    }
    link.setAttribute('data-status', status);
    if (matchData.gameDate) {
        link.setAttribute('data-game-date', matchData.gameDate);
    }
    
    // Event-Handler für Link
    if (matchData.numericGameId) {
        link.addEventListener('click', function(e) {
            e.stopPropagation();
            console.log(`🔗 Opening game details for game ID: ${matchData.numericGameId} (Status: ${status})`);
        });
    }
    
    // Link zum Match hinzufügen
    console.log(`   ➕ Appending link to match element`);
    matchElement.appendChild(link);
    
    // Stelle sicher dass Match relative Positionierung hat
    const currentPosition = getComputedStyle(matchElement).position;
    if (currentPosition === 'static') {
        matchElement.style.position = 'relative';
        console.log(`   🎯 Set match position to relative (was ${currentPosition})`);
    }
    
    // Force Layout-Update
    matchElement.offsetHeight;
    
    // Prüfe ob Link erfolgreich hinzugefügt wurde
    const addedLink = matchElement.querySelector('.smart-match-link');
    if (addedLink) {
        console.log(`   ✅ Link successfully added with status: ${status}`);
    } else {
        console.log(`   ❌ ERROR: Link not found in DOM after adding!`);
    }
}

function removeSmartMatchLinks() {
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
    console.log('\n🔍 DEBUG: Enhanced Smart Match Links');
    console.log('='.repeat(60));
    
    // Prüfe ob currentGames verfügbar ist
    if (typeof window !== 'undefined' && window.currentGames) {
        console.log(`📊 currentGames available: ${window.currentGames.length} games`);
        console.log('Sample game:', window.currentGames[0]);
    } else {
        console.log('❌ currentGames not available');
    }
    
    const smartMatches = document.querySelectorAll('.smart-match-absolute');
    console.log(`Found ${smartMatches.length} smart match elements`);
    console.log('='.repeat(60));
    
    smartMatches.forEach((match, index) => {
        const matchData = getMatchDataFromSmartMatch(match);
        const status = determineMatchStatus(matchData);
        const team1Text = getTeamText(match, 0);
        const team2Text = getTeamText(match, 1);
        const isFreilos = isSmartFreilosMatch(match);
        const isPrognose = isSmartPrognoseMatch(match);
        const shouldCreate = shouldCreateSmartMatchLink(match, matchData);
        const hasLink = match.querySelector('.smart-match-link') !== null;
        
        console.log(`\n${index + 1}. "${team1Text}" vs "${team2Text}"`);
        console.log(`   Status: ${status} | Link: ${hasLink ? '✅' : '❌'} | Should: ${shouldCreate ? '✅' : '❌'}`);
        console.log(`   GameID: ${matchData.gameId || 'none'} | NumericID: ${matchData.numericGameId || 'none'}`);
        console.log(`   Result: "${matchData.result || 'none'}" | GameDate: ${matchData.gameDate || 'none'}`);
        console.log(`   Freilos: ${isFreilos} | Prognose: ${isPrognose}`);
        
        if (shouldCreate && !hasLink) {
            console.log(`   ⚠️ MISSING LINK!`);
        }
        if (!shouldCreate && hasLink) {
            console.log(`   ⚠️ UNEXPECTED LINK!`);
        }
    });
    
    console.log('\n' + '='.repeat(60));
}

// Auto-Initialisierung Setup
function setupSmartLinksObserver() {
    if (smartLinksObserver) {
        return;
    }
    
    smartLinksObserver = new MutationObserver(function(mutations) {
        let shouldReinitialize = false;
        
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
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
        
        if (shouldReinitialize && !smartLinksInitialized) {
            setTimeout(() => {
                if (!smartLinksInitialized) {
                    initializeSmartMatchLinks();
                }
            }, 500);
        }
    });
    
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