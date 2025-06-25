// Smart Match Links - Vereinfachte Version für PostgreSQL
console.log('🔧 Smart Match Links startet...');

let lastSmartMatchCount = 0;
let initTimeout = null;

// Hauptfunktion - erstelle Links für alle Smart Matches
function initializeSmartMatchLinks() {
    console.log('\n🎯 INITIALISIERE SMART MATCH LINKS...');
    console.log('='.repeat(50));
    
    const smartMatches = document.querySelectorAll('.smart-match-absolute');
    console.log(`🔍 Gefundene Smart Matches: ${smartMatches.length}`);
    
    if (smartMatches.length === 0) {
        console.log('❌ Keine Smart Matches gefunden');
        return;
    }
    
    let createdLinks = 0;
    let skippedLinks = 0;
    
    smartMatches.forEach((match, index) => {
        // Prüfe ob bereits ein Link existiert
        if (match.querySelector('.smart-match-link')) {
            console.log(`⏭️ Match ${index + 1}: Link bereits vorhanden`);
            return;
        }
        
        // Hole Game ID
        const gameid = match.getAttribute('data-game-id');
        console.log(`📝 Match ${index + 1}: game-id="${gameid}"`);
        
        if (!gameid || gameid === '' || gameid === 'null' || gameid === 'undefined') {
            console.log(`⏭️ Match ${index + 1}: Keine gültige game-id`);
            skippedLinks++;
            return;
        }
        
        // Hole Team Namen
        const teams = match.querySelectorAll('.team-name');
        const team1 = teams[0] ? teams[0].textContent.trim() : '';
        const team2 = teams[1] ? teams[1].textContent.trim() : '';
        
        console.log(`📝 Match ${index + 1}: "${team1}" vs "${team2}"`);
        
        // Ignoriere Freilos und TBD Spiele
        if (team1.toLowerCase() === 'freilos' || team2.toLowerCase() === 'freilos') {
            console.log(`⏭️ Match ${index + 1}: Freilos-Spiel ignoriert`);
            skippedLinks++;
            return;
        }
        if (team1 === 'TBD' && team2 === 'TBD') {
            console.log(`⏭️ Match ${index + 1}: TBD-Spiel ignoriert`);
            skippedLinks++;
            return;
        }
        if (!team1 || !team2) {
            console.log(`⏭️ Match ${index + 1}: Unvollständige Teams`);
            skippedLinks++;
            return;
        }
        
        // Prüfe Spielstatus
        const scoreElements = match.querySelectorAll('.team-score');
        const hasScore = scoreElements.length === 2 && 
                        scoreElements[0].textContent.trim() !== '' && 
                        scoreElements[1].textContent.trim() !== '';
        
        const hasWinner = match.querySelector('.team.winner') !== null;
        const status = (hasScore || hasWinner) ? 'played' : 'scheduled';
        
        // Erstelle Link Element
        const link = document.createElement('a');
        link.className = `smart-match-link ${status}`;
        link.href = `https://www.swissunihockey.ch/de/game-detail?game_id=${gameid}`;
        link.target = '_blank';
        link.setAttribute('data-status', status);
        link.setAttribute('data-game-id', gameid);
        
        // Inline CSS für Link (falls externe CSS nicht lädt)
        link.style.cssText = `
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            z-index: 10 !important;
            text-decoration: none !important;
            display: block !important;
            border-radius: 4px !important;
            transition: background-color 0.2s ease !important;
        `;
        
        // Hover-Effekte
        if (status === 'played') {
            link.style.backgroundColor = 'rgba(0, 123, 255, 0.1)';
        } else {
            link.style.backgroundColor = 'rgba(108, 117, 125, 0.1)';
        }
        
        link.addEventListener('mouseenter', function() {
            this.style.backgroundColor = 'rgba(255, 193, 7, 0.2)';
        });
        
        link.addEventListener('mouseleave', function() {
            if (status === 'played') {
                this.style.backgroundColor = 'rgba(0, 123, 255, 0.1)';
            } else {
                this.style.backgroundColor = 'rgba(108, 117, 125, 0.1)';
            }
        });
        
        // Stelle sicher dass das Match Element relative Position hat
        const matchStyle = getComputedStyle(match);
        if (matchStyle.position === 'static') {
            match.style.position = 'relative';
        }
        
        // Füge Link hinzu
        match.appendChild(link);
        createdLinks++;
        
        console.log(`✅ Match ${index + 1}: Link erstellt (${status})`);
    });
    
    console.log(`\n📊 ZUSAMMENFASSUNG:`);
    console.log(`  ✅ Links erstellt: ${createdLinks}`);
    console.log(`  ⏭️ Übersprungen: ${skippedLinks}`);
    console.log(`  📊 Total Matches: ${smartMatches.length}`);
    
    // Nach Link-Erstellung Game Details initialisieren
    if (createdLinks > 0) {
        setTimeout(() => {
            console.log('🎯 Initialisiere Game Details...');
            initializeGameDetails();
        }, 200);
    }
    
    return createdLinks;
}

// Überwache Smart Bracket Änderungen
function startSmartBracketObserver() {
    console.log('👁️ Starte Smart Bracket Observer...');
    
    // Überwache das gesamte Document für Smart Bracket Änderungen
    const observer = new MutationObserver(function(mutations) {
        let hasSmartBracketChanges = false;
        
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                // Prüfe ob Smart Bracket Container hinzugefügt wurde
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.classList && node.classList.contains('smart-bracket')) {
                            hasSmartBracketChanges = true;
                        }
                        // Oder wenn Smart Matches hinzugefügt wurden
                        if (node.querySelectorAll && node.querySelectorAll('.smart-match-absolute').length > 0) {
                            hasSmartBracketChanges = true;
                        }
                    }
                });
            }
        });
        
        if (hasSmartBracketChanges) {
            console.log('🔄 Smart Bracket Änderung erkannt');
            clearTimeout(initTimeout);
            initTimeout = setTimeout(() => {
                checkAndInitializeLinks();
            }, 300);
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('✅ Observer gestartet');
}

// Prüfe und initialisiere Links
function checkAndInitializeLinks() {
    const currentSmartMatches = document.querySelectorAll('.smart-match-absolute');
    const currentCount = currentSmartMatches.length;
    
    console.log(`🔍 Aktuelle Smart Matches: ${currentCount} (vorher: ${lastSmartMatchCount})`);
    
    if (currentCount > 0 && currentCount !== lastSmartMatchCount) {
        console.log('🎯 Neue Smart Matches erkannt, initialisiere Links...');
        lastSmartMatchCount = currentCount;
        
        const createdLinks = initializeSmartMatchLinks();
        
        if (createdLinks === 0) {
            console.log('⚠️ Keine Links erstellt, versuche erneut in 1s...');
            setTimeout(checkAndInitializeLinks, 1000);
        }
    } else if (currentCount === 0) {
        console.log('⏳ Noch keine Smart Matches, versuche erneut in 1s...');
        setTimeout(checkAndInitializeLinks, 1000);
    }
}

// Reset-Funktion für neues Bracket
function resetSmartMatchLinks() {
    lastSmartMatchCount = 0;
    console.log('🔄 Smart Match Links reset');
}

// =============================================================================
// GAME DETAILS 
// =============================================================================

let gameDetails = null;
let detailsTimeout = null;
let currentDetailsGameId = null;
const DETAILS_DELAY = 800;

function createGameDetails() {
    if (gameDetails) return gameDetails;
    
    gameDetails = document.createElement('div');
    gameDetails.className = 'game-details-popup';
    gameDetails.style.cssText = `
        position: fixed !important;
        z-index: 99999 !important;
        display: none !important;
        pointer-events: none !important;
        opacity: 0 !important;
        transform: translateY(10px) !important;
        transition: opacity 0.2s ease, transform 0.2s ease !important;
        background: white !important;
        border: 1px solid #ccc !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important;
        padding: 16px !important;
        width: 320px !important;
        max-width: 320px !important;
        font-family: Arial, sans-serif !important;
        font-size: 14px !important;
        line-height: 1.4 !important;
    `;
    
    document.body.appendChild(gameDetails);
    console.log('🔧 Game Details Container erstellt');
    return gameDetails;
}

function createDetailsContentFromDB(gameDetailsData) {
    if (!gameDetailsData || gameDetailsData.error) {
        return '<div style="padding: 20px; text-align: center; color: #ff6666;">❌ Keine Spieldaten gefunden</div>';
    }

    const homeName = gameDetailsData.home_name || gameDetailsData.team1 || 'Unbekannt';
    const awayName = gameDetailsData.away_name || gameDetailsData.team2 || 'Unbekannt';
    const result = gameDetailsData.result || '';
    const dateText = gameDetailsData.date || '';
    const timeText = gameDetailsData.time || '';
    const location = gameDetailsData.location || '';

    let mainScore = result && result !== 'TBD' ? result.split(' ')[0] : '-:-';
    
    // Datum formatieren
    let displayDate = dateText;
    if (dateText) {
        const dateMatch = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dateMatch) {
            displayDate = `${dateMatch[3]}.${dateMatch[2]}.${dateMatch[1]}`;
        }
    }

    return `
        <div style="text-align: center;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 12px; color: #666;">
                <span>${displayDate || 'TBD'}</span>
                <span>${timeText || 'TBD'}</span>
            </div>

            <div style="display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 8px;">
                <div style="text-align: center; flex: 1;">
                    <div style="font-size: 14px; font-weight: bold;">${homeName}</div>
                </div>
                
                <div style="text-align: center; min-width: 80px;">
                    <div style="font-size: 18px; font-weight: bold; color: #333;">${mainScore}</div>
                </div>
                
                <div style="text-align: center; flex: 1;">
                    <div style="font-size: 14px; font-weight: bold;">${awayName}</div>
                </div>
            </div>

            ${location ? `<div style="font-size: 12px; color: #666; margin-top: 8px;">📍 ${location}</div>` : ''}
        </div>
    `;
}

function positionGameDetails(details, targetElement) {
    const targetRect = targetElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let left = targetRect.right + 10;
    let top = targetRect.top + (targetRect.height / 2) - 120;
    
    if (left + 320 > viewportWidth - 20) {
        left = targetRect.left - 330;
    }
    
    if (left < 20) {
        left = targetRect.left + (targetRect.width / 2) - 160;
        top = targetRect.bottom + 10;
    }
    
    if (top < 20) {
        top = 20;
    }
    
    if (top + 240 > viewportHeight - 20) {
        top = viewportHeight - 260;
    }
    
    details.style.left = `${left}px`;
    details.style.top = `${top}px`;
}

async function showGameDetails(gameid, targetElement) {
    console.log(`🎯 showGameDetails für gameid: ${gameid}`);
    
    if (currentDetailsGameId === gameid) return;
    
    const details = createGameDetails();
    currentDetailsGameId = gameid;
    
    try {
        details.innerHTML = '<div style="padding: 20px; text-align: center; color: #333;">⏳ Lade Spieldaten...</div>';
        
        details.style.setProperty('display', 'block', 'important');
        details.style.setProperty('opacity', '1', 'important');
        details.style.setProperty('visibility', 'visible', 'important');
        details.style.setProperty('transform', 'translateY(0)', 'important');
        
        positionGameDetails(details, targetElement);
        
        const response = await fetch(`/api/game-details/${gameid}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const gameDetailsData = await response.json();
        
        if (currentDetailsGameId !== gameid) return;
        
        details.innerHTML = createDetailsContentFromDB(gameDetailsData);
        positionGameDetails(details, targetElement);
        
        console.log('✅ Game Details angezeigt');
        
    } catch (error) {
        console.error(`❌ Fehler beim Laden von Game ${gameid}:`, error);
        
        if (currentDetailsGameId !== gameid) return;
        
        details.innerHTML = '<div style="padding: 20px; text-align: center; color: #ff6666;">❌ Spiel nicht gefunden</div>';
        details.style.setProperty('display', 'block', 'important');
        details.style.setProperty('opacity', '1', 'important');
        positionGameDetails(details, targetElement);
    }
}

function hideGameDetails() {
    if (gameDetails) {
        gameDetails.style.opacity = '0';
        gameDetails.style.transform = 'translateY(10px)';
        
        setTimeout(() => {
            if (gameDetails) {
                gameDetails.style.display = 'none';
            }
        }, 200);
    }
    
    currentDetailsGameId = null;
    
    if (detailsTimeout) {
        clearTimeout(detailsTimeout);
        detailsTimeout = null;
    }
}

function initializeGameDetails() {
    console.log('🎯 Initialisiere Game Details...');
    
    const smartMatchLinks = document.querySelectorAll('.smart-match-link');
    console.log(`🔍 Gefundene Smart Match Links: ${smartMatchLinks.length}`);
    
    // Entferne alte Events
    smartMatchLinks.forEach(link => {
        if (link.hasAttribute('data-details-events')) {
            link.removeAttribute('data-details-events');
        }
    });
    
    let validLinksCount = 0;
    
    smartMatchLinks.forEach((link, index) => {
        const gameid = link.getAttribute('data-game-id');
        
        if (!gameid || gameid === '' || gameid === 'null' || gameid === 'undefined') {
            return;
        }
        
        validLinksCount++;
        link.setAttribute('data-details-events', 'true');
        
        link.addEventListener('mouseenter', function(e) {
            if (detailsTimeout) {
                clearTimeout(detailsTimeout);
            }
            
            detailsTimeout = setTimeout(() => {
                showGameDetails(gameid, link);
            }, DETAILS_DELAY);
        });
        
        link.addEventListener('mouseleave', function(e) {
            if (detailsTimeout) {
                clearTimeout(detailsTimeout);
                detailsTimeout = null;
            }
            
            hideGameDetails();
        });
    });
    
    console.log(`✅ Game Details initialisiert für ${validLinksCount} Links`);
}

// Cleanup Events
window.addEventListener('scroll', hideGameDetails);
window.addEventListener('resize', hideGameDetails);

// Debug Funktionen
window.testGameDetails = function(gameid = '12345') {
    const testElement = document.createElement('div');
    testElement.style.cssText = `
        position: fixed !important; 
        top: 50px !important; 
        right: 50px !important; 
        width: 200px !important; 
        height: 60px !important; 
        background: red !important; 
        z-index: 9999 !important;
        color: white !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 14px !important;
        cursor: pointer !important;
    `;
    testElement.textContent = `TEST (${gameid})`;
    document.body.appendChild(testElement);
    
    testElement.addEventListener('mouseenter', () => showGameDetails(gameid, testElement));
    testElement.addEventListener('mouseleave', () => hideGameDetails());
    
    setTimeout(() => {
        if (document.body.contains(testElement)) {
            document.body.removeChild(testElement);
        }
    }, 10000);
};

window.debugSmartLinks = function() {
    console.log('🔍 DEBUG: Smart Links');
    const matches = document.querySelectorAll('.smart-match-absolute');
    const links = document.querySelectorAll('.smart-match-link');
    
    console.log(`Smart Matches: ${matches.length}`);
    console.log(`Smart Links: ${links.length}`);
    
    matches.forEach((match, i) => {
        if (i < 5) { // Erste 5
            console.log(`Match ${i + 1}:`, {
                gameid: match.getAttribute('data-game-id'),
                hasLink: !!match.querySelector('.smart-match-link'),
                teams: Array.from(match.querySelectorAll('.team-name')).map(t => t.textContent.trim())
            });
        }
    });
};

// Starte alles
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM loaded, starte Smart Match Links...');
    
    // Starte Observer
    startSmartBracketObserver();
    
    // Initiale Prüfung
    setTimeout(checkAndInitializeLinks, 500);
    setTimeout(checkAndInitializeLinks, 2000); // Backup check
});

// Exportiere Funktionen
window.resetSmartMatchLinks = resetSmartMatchLinks;
window.initializeSmartMatchLinks = initializeSmartMatchLinks;
window.initializeGameDetails = initializeGameDetails;
window.hideGameDetails = hideGameDetails;

console.log('✅ Smart Match Links Script geladen');