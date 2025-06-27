// Smart Links Fix - Wartet auf Bracket-Load und überwacht Änderungen
// DEBUG VERSION mit Game Details Integration

console.log('🔧 Smart Links Monitoring startet...');

// Observer für Smart Bracket Änderungen
let bracketObserver = null;
let lastSmartMatchCount = 0;

function startBracketMonitoring() {
    const bracketContainer = document.querySelector('.bracket-container');
    if (!bracketContainer) {
        console.log('❌ Bracket Container nicht gefunden, versuche erneut in 1s...');
        setTimeout(startBracketMonitoring, 1000);
        return;
    }
    
    // Observer für Änderungen im Bracket Container
    bracketObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                // Prüfe ob Smart Matches hinzugefügt wurden
                checkForNewSmartMatches();
            }
        });
    });
    
    bracketObserver.observe(bracketContainer, { 
        childList: true, 
        subtree: true 
    });
    
    console.log('👁️ Bracket Observer gestartet');
    
    // Initiale Prüfung
    setTimeout(checkForNewSmartMatches, 500);
}

function checkForNewSmartMatches() {
    const currentSmartMatches = document.querySelectorAll('.smart-match-absolute');
    const currentCount = currentSmartMatches.length;
    
    if (currentCount > 0 && currentCount !== lastSmartMatchCount) {
        console.log(`\n🎯 NEUE SMART MATCHES ERKANNT: ${currentCount} (war: ${lastSmartMatchCount})`);
        lastSmartMatchCount = currentCount;
        
        // Warte kurz damit das Bracket vollständig geladen ist
        setTimeout(() => {
            checkAndCreateSmartLinks();
        }, 300);
    }
}

function checkAndCreateSmartLinks() {
    console.log('\n🔍 SMART LINKS CHECK:');
    console.log('='.repeat(50));
    
    const smartMatches = document.querySelectorAll('.smart-match-absolute');
    const existingLinks = document.querySelectorAll('.smart-match-link');
    
    console.log(`Smart Matches: ${smartMatches.length}`);
    console.log(`Bestehende Links: ${existingLinks.length}`);
    console.log(`initializeSmartMatchLinks verfügbar: ${typeof window.initializeSmartMatchLinks}`);
    
    // Falls die Original-Funktion existiert, verwende sie
    if (typeof window.initializeSmartMatchLinks === 'function') {
        console.log('✅ Verwende Original initializeSmartMatchLinks Funktion');
        try {
            window.initializeSmartMatchLinks();
            // WICHTIG: Game Details nach Link-Erstellung initialisieren
            setTimeout(() => {
                console.log('🎯 Initialisiere Game Details nach Original-Funktion...');
                initializeGameDetails();
            }, 200);
        } catch (error) {
            console.log('❌ Fehler in Original-Funktion:', error);
            console.log('🔧 Fallback zu eigener Implementation...');
            createCustomSmartLinks();
        }
    } else if (existingLinks.length === 0 && smartMatches.length > 0) {
        console.log('🔧 Original-Funktion nicht verfügbar, erstelle eigene Links');
        createCustomSmartLinks();
    } else if (existingLinks.length > 0) {
        console.log('✅ Links bereits vorhanden');
        analyzeAndUpgradeLinks();
        // WICHTIG: Game Details auch für existierende Links initialisieren
        setTimeout(() => {
            console.log('🎯 Initialisiere Game Details für existierende Links...');
            initializeGameDetails();
        }, 200);
    }
}

function createCustomSmartLinks() {
    console.log('\n🔧 ERSTELLE CUSTOM SMART LINKS...');
    
    const smartMatches = document.querySelectorAll('.smart-match-absolute');
    let createdLinks = 0;
    let skippedNoGameId = 0;
    
    smartMatches.forEach((match) => {
        // Prüfe ob bereits ein Link existiert
        if (match.querySelector('.smart-match-link')) return;
        
        // Prüfe numericgameid - NEUE PRÜFUNG
        const gameid = match.getAttribute('data-game-id');
        if (!gameid || gameid === '' || gameid === 'null' || gameid === 'undefined') {
            skippedNoGameId++;
            console.log(`⏭️ Überspringe Match ohne gültige gameid: "${gameid}"`);
            return;
        }
        
        const teams = match.querySelectorAll('.team-name');
        const team1 = teams[0] ? teams[0].textContent.trim() : '';
        const team2 = teams[1] ? teams[1].textContent.trim() : '';
        
        // Ignoriere Freilos und TBD Spiele
        if (team1.toLowerCase() === 'freilos' || team2.toLowerCase() === 'freilos') return;
        if (team1 === 'TBD' && team2 === 'TBD') return;
        if (!team1 || !team2) return;
        
        // Prüfe ob Ergebnis vorhanden
        const scoreElements = match.querySelectorAll('.team-score');
        const hasScore = scoreElements.length === 2 && 
                        scoreElements[0].textContent.trim() !== '' && 
                        scoreElements[1].textContent.trim() !== '';
        
        const hasWinner = match.querySelector('.team.winner') !== null;
        
        // Basis-Status
        const status = (hasScore || hasWinner) ? 'played' : 'scheduled';
        
        // Erstelle Link
        const link = document.createElement('a');
        link.className = `smart-match-link ${status}`;
        
        // URL und Attribute - gameid ist hier garantiert gültig
        link.href = `https://www.swissunihockey.ch/de/game-detail?game_id=${gameid}`;
        link.target = '_blank';
        
        link.setAttribute('data-status', status);
        link.setAttribute('data-game-id', gameid);
        // link.title = `${team1} vs ${team2}`; // ENTFERNT: Verhindert Browser-Tooltips
        
        // Position sicherstellen
        if (getComputedStyle(match).position === 'static') {
            match.style.position = 'relative';
        }
        
        // Link hinzufügen
        match.appendChild(link);
        createdLinks++;
    });
    
    console.log(`✅ ${createdLinks} Custom Smart Links erstellt`);
    if (skippedNoGameId > 0) {
        console.log(`⏭️ ${skippedNoGameId} Matches ohne gültige numericgameid übersprungen`);
    }
    
    // Nach kurzer Verzögerung versuche Upgrade mit Datums-Detection
    setTimeout(() => {
        if (createdLinks > 0) {
            upgradeLinksWithDateDetection();
            // WICHTIG: Game Details nach Link-Erstellung initialisieren
            setTimeout(() => {
                console.log('🎯 Initialisiere Game Details nach Custom Links...');
                initializeGameDetails();
            }, 200);
        }
    }, 1000);
}

// [Alle anderen Funktionen bleiben gleich...]
function analyzeAndUpgradeLinks() {
    const links = document.querySelectorAll('.smart-match-link');
    const statusCount = {};
    
    links.forEach(link => {
        const status = link.getAttribute('data-status') || 'unknown';
        statusCount[status] = (statusCount[status] || 0) + 1;
    });
    
    console.log('\n📊 LINK STATUS:');
    Object.entries(statusCount).forEach(([status, count]) => {
        const emoji = { 'played': '🔵', 'scheduled': '⚪', 'today': '🔴', 'tomorrow': '🟡' }[status] || '❓';
        console.log(`  ${emoji} ${status}: ${count}`);
    });
    
    // Falls kein heute/morgen, versuche Upgrade
    if (!statusCount.today && !statusCount.tomorrow && statusCount.scheduled > 0) {
        console.log('🔄 Versuche Upgrade mit Datums-Detection...');
        upgradeLinksWithDateDetection();
    }
}

// [Alle upgrade-Funktionen hier einfügen - verkürzt für Übersichtlichkeit]
function upgradeLinksWithDateDetection() {
    console.log('🔄 Date detection upgrade...');
    // Implementation hier...
}

function showFinalStats() {
    const allLinks = document.querySelectorAll('.smart-match-link');
    const finalStats = {};
    
    allLinks.forEach(link => {
        const status = link.getAttribute('data-status') || 'unknown';
        finalStats[status] = (finalStats[status] || 0) + 1;
    });
    
    console.log('\n📊 FINALE SMART LINKS STATISTIK:');
    console.log('='.repeat(50));
    Object.entries(finalStats).forEach(([status, count]) => {
        const emoji = { 'played': '🔵', 'scheduled': '⚪' }[status] || '❓';
        console.log(`  ${emoji} ${status.toUpperCase()}: ${count} Links`);
    });
    
    console.log('\n✅ Smart Links Setup komplett!');
}

// Reset-Funktion für neues Bracket
function resetSmartMatchLinks() {
    lastSmartMatchCount = 0;
    console.log('🔄 Smart Match Links reset');
}

// =============================================================================
// GAME DETAILS EXTENSION - KORRIGIERTE VERSION
// =============================================================================

// Game Details Variablen
let gameDetails = null;
let detailsTimeout = null;
let currentDetailsGameId = null;
const DETAILS_DELAY = 800; // 800ms Verzögerung

// Erstelle Game Details Container (einmalig)
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
    `;
    
    document.body.appendChild(gameDetails);
    console.log('🔧 Game Details Container erstellt und zu body hinzugefügt');
    return gameDetails;
}

// Hilfsfunktion zur Gewinner-Bestimmung
function determineWinner(scoreText, team) {
    if (!scoreText || scoreText === '-:-') return false;
    
    const match = scoreText.match(/(\d+):(\d+)/);
    if (!match) return false;
    
    const homeScore = parseInt(match[1]);
    const awayScore = parseInt(match[2]);
    
    if (homeScore === awayScore) return false;
    
    return (team === 'home' && homeScore > awayScore) || (team === 'away' && awayScore > homeScore);
}

// Erstelle Game Details Inhalt aus Datenbank-Daten
function createDetailsContentFromDB(gameDetailsData) {
    if (!gameDetailsData || gameDetailsData.error) {
        return '<div class="game-details-error">Keine Spieldaten in Datenbank gefunden</div>';
    }

    // Daten aus Datenbank extrahieren
    const homeName = gameDetailsData.home_name || 'Unbekannt';
    const awayName = gameDetailsData.away_name || 'Unbekannt';
    const homeLogoUrl = gameDetailsData.home_logo || null;
    const awayLogoUrl = gameDetailsData.away_logo || null;
    const result = gameDetailsData.result || '';
    const subtitle = gameDetailsData.subtitle || '';
    const dateText = gameDetailsData.date || '';
    const timeText = gameDetailsData.time || '';
    const location = gameDetailsData.location || '';
    const locationX = gameDetailsData.location_x || null;
    const locationY = gameDetailsData.location_y || null;
    const firstReferee = gameDetailsData.first_referee || '';
    const secondReferee = gameDetailsData.second_referee || '';
    const spectators = gameDetailsData.spectators || '';

    // Ergebnis und Perioden parsen
    let mainScore = '';
    let periods = '';
    
    if (result) {
        const resultParts = result.split(' ');
        mainScore = resultParts[0] || '';
        
        // Suche nach Klammern für Perioden
        const periodsMatch = result.match(/\(([^)]+)\)/);
        if (periodsMatch) {
            periods = periodsMatch[1];
        } else if (resultParts.length > 1) {
            periods = resultParts.slice(1).join(' ');
        }
    }

    // Schiedsrichter-Nachnamen extrahieren
    const ref1LastName = firstReferee ? firstReferee.split(' ').pop() : '';
    const ref2LastName = secondReferee ? secondReferee.split(' ').pop() : '';
    
    // Schiedsrichter formatieren - untereinander
    let refDisplay = '';
    if (ref1LastName && ref2LastName) {
        refDisplay = `<div>${ref1LastName}</div><div>${ref2LastName}</div>`;
    } else if (ref1LastName || ref2LastName) {
        refDisplay = `<div>${ref1LastName || ref2LastName}</div>`;
    } else {
        refDisplay = '<div>TBD</div>';
    }

    // Bestimme Gewinner
    const isHomeWinner = determineWinner(mainScore, 'home');
    const isAwayWinner = determineWinner(mainScore, 'away');

    // Datum formatieren
    let displayDate = dateText;
    if (dateText) {
        const dateMatch = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dateMatch) {
            const today = new Date();
            const gameDate = new Date(dateMatch[1], parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]));
            
            const diffDays = Math.floor((gameDate - today) / (1000 * 60 * 60 * 24));
            if (diffDays === 0) {
                displayDate = 'Heute';
            } else if (diffDays === -1) {
                displayDate = 'Gestern';
            } else if (diffDays === 1) {
                displayDate = 'Morgen';
            } else {
                displayDate = `${dateMatch[3]}.${dateMatch[2]}.${dateMatch[1]}`;
            }
        }
    }

    // Kompaktes HTML mit CSS-Klassen - Info oben, Resultat zwischen Teams
    return `
        <div class="game-details-content">
            <div class="game-details-info-simple">
                <span class="info-simple">${displayDate || 'TBD'}</span>
                <span class="info-simple">${timeText || 'TBD'}</span>
                <span class="info-simple info-refs-simple">${refDisplay}</span>
                <span class="info-simple">${spectators || '-'}</span>
            </div>

            <div class="game-details-teams">
                <div class="game-details-team ${isHomeWinner ? 'winner' : ''}">
                    <div class="game-details-logo">
                        ${homeLogoUrl ? `<img src="${homeLogoUrl}" alt="${homeName}">` : '<div class="logo-placeholder">?</div>'}
                    </div>
                    <div class="game-details-team-name">${homeName}</div>
                </div>
                <div class="game-details-middle">
                    <div class="game-details-vs">VS</div>
                    <div class="game-details-result-inline">
                        <div class="game-details-score-inline">${mainScore || '-:-'}</div>
                        ${periods ? `<div class="game-details-periods-inline">(${periods})</div>` : '<div class="game-details-periods-inline">Noch nicht gespielt</div>'}
                    </div>
                </div>
                <div class="game-details-team ${isAwayWinner ? 'winner' : ''}">
                    <div class="game-details-logo">
                        ${awayLogoUrl ? `<img src="${awayLogoUrl}" alt="${awayName}">` : '<div class="logo-placeholder">?</div>'}
                    </div>
                    <div class="game-details-team-name">${awayName}</div>
                </div>
            </div>

            ${subtitle ? `<div class="game-details-subtitle">${subtitle}</div>` : ''}
        </div>
    `;
}

// Game Details Position berechnen
function positionGameDetails(details, targetElement) {
    const targetRect = targetElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Verwende fixed positioning - kompakte Größe
    let left = targetRect.right + 10;
    let top = targetRect.top + (targetRect.height / 2) - 120; // Angepasst für kompaktere Höhe
    
    // Überprüfe rechten Rand
    if (left + 320 > viewportWidth - 20) { // 320px Breite
        left = targetRect.left - 330;
    }
    
    // Überprüfe linken Rand  
    if (left < 20) {
        left = targetRect.left + (targetRect.width / 2) - 160; // Zentriert
        top = targetRect.bottom + 10;
    }
    
    // Überprüfe oberen Rand
    if (top < 20) {
        top = 20;
    }
    
    // Überprüfe unteren Rand (ca. 240px Höhe für kompaktes Design)
    if (top + 240 > viewportHeight - 20) {
        top = viewportHeight - 260;
    }
    
    details.style.left = `${left}px`;
    details.style.top = `${top}px`;
    
    console.log(`📍 Details positioniert auf: left=${left}px, top=${top}px`);
}

// Game Details anzeigen (mit lokaler Datenbank)
async function showGameDetails(gameid, targetElement) {
    console.log(`🎯 showGameDetails aufgerufen für gameid: ${gameid}`);
    
    if (currentDetailsGameId === gameid) {
        console.log('⏭️ Details bereits für diese Game ID geladen');
        return;
    }
    
    const details = createGameDetails();
    currentDetailsGameId = gameid;
    
    try {
        // Loading State
        console.log('⏳ Zeige Loading State...');
        details.innerHTML = '<div style="padding: 20px; text-align: center; color: #fff; background: #ff6b00;">⏳ Lade Spieldaten...</div>';
        
        // DIREKTER CSS FIX - Setze alle Eigenschaften einzeln
        details.style.setProperty('display', 'block', 'important');
        details.style.setProperty('opacity', '1', 'important');
        details.style.setProperty('visibility', 'visible', 'important');
        details.style.setProperty('transform', 'translateY(0)', 'important');
        details.style.setProperty('z-index', '99999', 'important');
        details.style.setProperty('position', 'fixed', 'important');
        
        positionGameDetails(details, targetElement);
        
        console.log('👀 Details Element NACH Force:', {
            display: details.style.display,
            opacity: details.style.opacity,
            visibility: details.style.visibility,
            zIndex: details.style.zIndex,
            position: details.style.position,
            left: details.style.left,
            top: details.style.top,
            computed: {
                display: getComputedStyle(details).display,
                opacity: getComputedStyle(details).opacity,
                visibility: getComputedStyle(details).visibility
            }
        });
        
        console.log(`📡 Lade Daten für Game ${gameid}...`);
        
        // Lokale API Call (deine Datenbank)
        const response = await fetch(`/api/game-details/${gameid}`);
        
        console.log(`📡 Response status: ${response.status}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const gameDetailsData = await response.json();
        console.log('📋 Game Details erhalten:', gameDetailsData);
        
        // Prüfe ob Details noch relevant sind
        if (currentDetailsGameId !== gameid) {
            console.log('⏭️ Details nicht mehr relevant, abgebrochen');
            return;
        }
        
        // Update Content mit DB-Daten
        details.innerHTML = createDetailsContentFromDB(gameDetailsData);
        
        // ERNEUT FORCE NACH CONTENT UPDATE
        details.style.setProperty('display', 'block', 'important');
        details.style.setProperty('opacity', '1', 'important');
        details.style.setProperty('visibility', 'visible', 'important');
        
        positionGameDetails(details, targetElement);
        
        console.log('✅ Game Details erfolgreich angezeigt');
        
        // FINAL CHECK: Element wirklich sichtbar?
        setTimeout(() => {
            const computedStyle = getComputedStyle(details);
            console.log('🔍 FINAL VISIBILITY CHECK:', {
                display: computedStyle.display,
                opacity: computedStyle.opacity,
                visibility: computedStyle.visibility,
                zIndex: computedStyle.zIndex,
                position: computedStyle.position,
                left: computedStyle.left,
                top: computedStyle.top,
                width: computedStyle.width,
                height: computedStyle.height,
                elementExists: document.body.contains(details),
                boundingRect: details.getBoundingClientRect()
            });
            
            // NUCLEAR OPTION: Wenn immer noch nicht sichtbar
            if (computedStyle.display === 'none' || computedStyle.opacity === '0') {
                console.log('💥 NUCLEAR FIX: Element immer noch nicht sichtbar, erzwinge Sichtbarkeit');
                details.style.cssText = `
                    position: fixed !important;
                    display: block !important;
                    opacity: 1 !important;
                    visibility: visible !important;
                    z-index: 99999 !important;
                    background: red !important;
                    color: white !important;
                    padding: 20px !important;
                    border: 5px solid yellow !important;
                    left: 100px !important;
                    top: 100px !important;
                    width: 300px !important;
                    height: 200px !important;
                `;
                details.innerHTML = '<div>FORCE VISIBLE TEST</div>';
            }
        }, 100);
        
    } catch (error) {
        console.error(`❌ Fehler beim Laden von Game ${gameid} aus DB:`, error);
        
        if (currentDetailsGameId !== gameid) return;
        
        details.innerHTML = '<div style="padding: 20px; text-align: center; color: #ff6666; background: #fff;">❌ Spiel nicht in Datenbank gefunden</div>';
        details.style.setProperty('display', 'block', 'important');
        details.style.setProperty('opacity', '1', 'important');
        positionGameDetails(details, targetElement);
    }
}

// Game Details verstecken
function hideGameDetails() {
    console.log('🙈 hideGameDetails aufgerufen');
    
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

// Event Listeners für Smart Match Links - KORRIGIERTE VERSION
function initializeGameDetails() {
    console.log('\n🎯 INITIALISIERE GAME DETAILS (Database)...');
    console.log('='.repeat(50));
    
    // Entferne existierende Details Events
    document.querySelectorAll('.smart-match-link[data-details-events]').forEach(link => {
        link.removeAttribute('data-details-events');
        console.log('🧹 Entferne existierende Events von Link');
    });
    
    // Finde alle Smart Match Links
    const smartMatchLinks = document.querySelectorAll('.smart-match-link');
    console.log(`🔍 Gefundene Smart Match Links: ${smartMatchLinks.length}`);
    
    let validLinksCount = 0;
    
    smartMatchLinks.forEach((link, index) => {
        const gameid = link.getAttribute('data-game-id');
        console.log(`📝 Link ${index + 1}: gameid="${gameid}"`);
        
        if (!gameid || gameid === '' || gameid === 'null' || gameid === 'undefined') {
            console.log(`⏭️ Überspringe Link ${index + 1} - keine gültige gameid`);
            return;
        }
        
        validLinksCount++;
        
        // Markiere als initialisiert
        link.setAttribute('data-details-events', 'true');
        
        console.log(`✅ Initialisiere Events für Link ${index + 1} (gameid: ${gameid})`);
        
        // Mouse Enter
        link.addEventListener('mouseenter', function(e) {
            console.log(`🖱️ Mouse Enter auf Link mit gameid: ${gameid}`);
            
            if (detailsTimeout) {
                console.log('⏰ Clearing existing timeout');
                clearTimeout(detailsTimeout);
            }
            
            console.log(`⏰ Setting timeout (${DETAILS_DELAY}ms) für gameid: ${gameid}`);
            detailsTimeout = setTimeout(() => {
                console.log(`⏰ Timeout abgelaufen, zeige Details für gameid: ${gameid}`);
                showGameDetails(gameid, link);
            }, DETAILS_DELAY);
        });
        
        // Mouse Leave
        link.addEventListener('mouseleave', function(e) {
            console.log(`🖱️ Mouse Leave von Link mit gameid: ${gameid}`);
            
            if (detailsTimeout) {
                console.log('⏰ Clearing timeout on mouse leave');
                clearTimeout(detailsTimeout);
                detailsTimeout = null;
            }
            
            hideGameDetails();
        });
        
        console.log(`✅ Events registriert für gameid: ${gameid}`);
    });
    
    console.log(`\n📊 GAME DETAILS INITIALISIERUNG ABGESCHLOSSEN:`);
    console.log(`  🔗 Gefundene Links: ${smartMatchLinks.length}`);
    console.log(`  ✅ Gültige Links: ${validLinksCount}`);
    console.log(`  ❌ Übersprungene Links: ${smartMatchLinks.length - validLinksCount}`);
    
    if (validLinksCount === 0) {
        console.log('⚠️ WARNUNG: Keine gültigen Links gefunden!');
        console.log('🔍 Debugging Info:');
        smartMatchLinks.forEach((link, index) => {
            console.log(`  Link ${index + 1}:`, {
                gameid: link.getAttribute('data-game-id'),
                className: link.className,
                href: link.href
            });
        });
    }
}

// Cleanup bei Browser-Events
window.addEventListener('scroll', hideGameDetails);
window.addEventListener('resize', hideGameDetails);

// DEBUG: Test-Funktion für manuellen Aufruf
window.testGameDetails = function(gameid = '12345') {
    console.log(`🧪 TEST: Game Details für ID ${gameid}`);
    
    // Erstelle einen Test-Button der sichtbar ist
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
        border: 2px solid yellow !important;
    `;
    testElement.textContent = `TEST HOVER (${gameid})`;
    document.body.appendChild(testElement);
    
    // Event Listeners für Test
    testElement.addEventListener('mouseenter', () => {
        console.log('🧪 TEST: Mouse Enter');
        showGameDetails(gameid, testElement);
    });
    
    testElement.addEventListener('mouseleave', () => {
        console.log('🧪 TEST: Mouse Leave');
        hideGameDetails();
    });
    
    console.log('🧪 TEST: Test-Element erstellt. Fahre mit der Maus darüber!');
    
    // Entferne nach 10 Sekunden
    setTimeout(() => {
        if (document.body.contains(testElement)) {
            document.body.removeChild(testElement);
        }
    }, 10000);
};

// DEBUG: Zeige alle aktuellen Game Details Container
window.debugGameDetails = function() {
    console.log('🔍 DEBUG: Aktuelle Game Details Container:');
    const containers = document.querySelectorAll('.game-details-popup, .game-details');
    console.log(`Gefunden: ${containers.length} Container`);
    
    containers.forEach((container, index) => {
        const style = getComputedStyle(container);
        console.log(`Container ${index + 1}:`, {
            className: container.className,
            display: style.display,
            opacity: style.opacity,
            visibility: style.visibility,
            zIndex: style.zIndex,
            position: style.position,
            left: style.left,
            top: style.top,
            width: style.width,
            height: style.height
        });
    });
    
    // Teste auch die Links
    const links = document.querySelectorAll('.smart-match-link');
    console.log(`Smart Match Links: ${links.length}`);
    
    links.forEach((link, index) => {
        if (index < 3) { // Nur die ersten 3
            console.log(`Link ${index + 1}:`, {
                gameid: link.getAttribute('data-game-id'),
                hasEvents: link.getAttribute('data-details-events'),
                rect: link.getBoundingClientRect()
            });
        }
    });
};

// Starte Monitoring
startBracketMonitoring();

// Exportiere Funktionen
window.resetSmartMatchLinks = resetSmartMatchLinks;
window.initializeGameDetails = initializeGameDetails;
window.hideGameDetails = hideGameDetails;

console.log('👁️ Smart Links Monitoring mit Game Details gestartet - wartet auf Bracket...');