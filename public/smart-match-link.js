// Smart Links Fix - Wartet auf Bracket-Load und überwacht Änderungen

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
        
        // Prüfe numericGameId - NEUE PRÜFUNG
        const gameId = match.getAttribute('data-game-id');
        if (!gameId || gameId === '' || gameId === 'null' || gameId === 'undefined') {
            skippedNoGameId++;
            console.log(`⏭️ Überspringe Match ohne gültige gameId: "${gameId}"`);
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
        
        // URL und Attribute - gameId ist hier garantiert gültig
        link.href = `https://www.swissunihockey.ch/de/game-detail?game_id=${gameId}`;
        link.target = '_blank';
        
        link.setAttribute('data-status', status);
        link.setAttribute('data-game-id', gameId);
        link.title = `${team1} vs ${team2}`;
        
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
        console.log(`⏭️ ${skippedNoGameId} Matches ohne gültige gameId übersprungen`);
    }
    
    // Nach kurzer Verzögerung versuche Upgrade mit Datums-Detection
    setTimeout(() => {
        if (createdLinks > 0) {
            upgradeLinksWithDateDetection();
        }
    }, 1000);
}

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

function upgradeLinksWithDateDetection() {
    console.log('\n🎯 UPGRADE LINKS MIT DATUMS-DETECTION...');
    
    // Hole aktuelle Datum-Referenzen (Schweizer Zeit)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    console.log(`📅 Heute: ${today.toLocaleDateString('de-CH')}`);
    console.log(`📅 Morgen: ${tomorrow.toLocaleDateString('de-CH')}`);
    
    // Erst versuche API-basiertes Upgrade
    fetch('/api/game-details?limit=3')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(testData => {
            console.log(`✅ gameDetails API verfügbar: ${testData.length} Test-Einträge`);
            if (testData.length > 0) {
                loadGameDetailsAndUpgrade(today, tomorrow);
            } else {
                throw new Error('Keine Test-Daten verfügbar');
            }
        })
        .catch(error => {
            console.log('❌ gameDetails API nicht verfügbar:', error.message);
            console.log('🔄 Fallback: DOM-basierte Datums-Detection...');
            upgradeLinksByDOMDetection(today, tomorrow);
        });
}

function loadGameDetailsAndUpgrade(today, tomorrow) {
    console.log('\n🔄 Lade gameDetails für API-basiertes Upgrade...');
    
    fetch('/api/game-details?limit=1000')
        .then(response => response.json())
        .then(gameDetails => {
            console.log(`📋 ${gameDetails.length} gameDetails geladen`);
            upgradeLinksWithAPIData(gameDetails, today, tomorrow);
        })
        .catch(error => {
            console.log('❌ Fehler beim Laden der gameDetails:', error);
            console.log('🔄 Fallback zu DOM-Detection...');
            upgradeLinksByDOMDetection(today, tomorrow);
        });
}

function upgradeLinksWithAPIData(gameDetails, today, tomorrow) {
    console.log('\n🎯 API-BASIERTES UPGRADE...');
    
    // Cache erstellen
    const gameCache = new Map();
    gameDetails.forEach(detail => {
        gameCache.set(detail.numericGameId, detail);
    });
    
    console.log(`🗂️ API Cache erstellt mit ${gameCache.size} Einträgen`);
    
    upgradeLinksWithCache(gameCache, today, tomorrow, 'API');
}

function upgradeLinksByDOMDetection(today, tomorrow) {
    console.log('\n🎯 DOM-BASIERTE DATUMS-DETECTION...');
    
    // Sammle alle Datum-Informationen aus dem DOM
    const gameCache = new Map();
    
    // Suche nach Datums-Pattern im gesamten DOM
    const allTextNodes = getAllTextNodes(document.body);
    const datePattern = /(\d{1,2})\.(\d{1,2})\.(\d{4})/g;
    
    let detectedDates = [];
    
    allTextNodes.forEach(node => {
        const text = node.textContent;
        let match;
        while ((match = datePattern.exec(text)) !== null) {
            detectedDates.push({
                dateStr: match[0],
                day: parseInt(match[1]),
                month: parseInt(match[2]) - 1,
                year: parseInt(match[3]),
                element: node.parentElement
            });
        }
    });
    
    console.log(`🔍 ${detectedDates.length} Datum-Pattern gefunden`);
    
    // Versuche Datums-Zuordnung zu Matches
    const smartMatches = document.querySelectorAll('.smart-match-absolute');
    
    smartMatches.forEach(match => {
        const gameId = match.getAttribute('data-game-id');
        if (!gameId) return;
        
        // Suche nahegelegene Datumsangaben
        const nearbyDate = findNearbyDate(match, detectedDates);
        if (nearbyDate) {
            gameCache.set(gameId, {
                numericGameId: gameId,
                date: nearbyDate.dateStr,
                parsedDate: new Date(nearbyDate.year, nearbyDate.month, nearbyDate.day)
            });
        }
    });
    
    console.log(`🗂️ DOM Cache erstellt mit ${gameCache.size} Einträgen`);
    
    upgradeLinksWithCache(gameCache, today, tomorrow, 'DOM');
}

function getAllTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );
    
    let node;
    while (node = walker.nextNode()) {
        if (node.textContent.trim()) {
            textNodes.push(node);
        }
    }
    
    return textNodes;
}

function findNearbyDate(matchElement, detectedDates) {
    // Finde das nächstgelegene Datum zu diesem Match
    let bestDate = null;
    let minDistance = Infinity;
    
    const matchRect = matchElement.getBoundingClientRect();
    const matchCenter = {
        x: matchRect.left + matchRect.width / 2,
        y: matchRect.top + matchRect.height / 2
    };
    
    detectedDates.forEach(dateInfo => {
        const dateRect = dateInfo.element.getBoundingClientRect();
        const dateCenter = {
            x: dateRect.left + dateRect.width / 2,
            y: dateRect.top + dateRect.height / 2
        };
        
        const distance = Math.sqrt(
            Math.pow(matchCenter.x - dateCenter.x, 2) + 
            Math.pow(matchCenter.y - dateCenter.y, 2)
        );
        
        if (distance < minDistance) {
            minDistance = distance;
            bestDate = dateInfo;
        }
    });
    
    return bestDate;
}

function upgradeLinksWithCache(gameCache, today, tomorrow, source) {
    console.log(`\n🎯 UPGRADE LINKS MIT ${source}-DATEN...`);
    
    const smartMatches = document.querySelectorAll('.smart-match-absolute');
    let upgradedCount = 0;
    let todayCount = 0;
    let tomorrowCount = 0;
    
    smartMatches.forEach(match => {
        const gameId = match.getAttribute('data-game-id');
        const link = match.querySelector('.smart-match-link');
        
        if (!gameId || !link || !gameCache.has(gameId)) return;
        
        const gameDetail = gameCache.get(gameId);
        let gameDate;
        
        if (source === 'API') {
            // API Daten: Parse YYYY-MM-DD oder DD.MM.YYYY Format
            const dateStr = gameDetail.date;
            if (!dateStr || dateStr.trim() === '') return;
            
            // Prüfe ISO Format (YYYY-MM-DD)
            const isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
            if (isoMatch) {
                const year = parseInt(isoMatch[1]);
                const month = parseInt(isoMatch[2]) - 1; // JS Monate 0-basiert
                const day = parseInt(isoMatch[3]);
                gameDate = new Date(year, month, day);
            } else {
                // Fallback: Europäisches Format (DD.MM.YYYY)
                const euMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
                if (euMatch) {
                    const day = parseInt(euMatch[1]);
                    const month = parseInt(euMatch[2]) - 1;
                    const year = parseInt(euMatch[3]);
                    gameDate = new Date(year, month, day);
                } else {
                    // Spezielle Werte wie "gestern" etc.
                    if (dateStr === 'gestern') {
                        gameDate = new Date(today);
                        gameDate.setDate(gameDate.getDate() - 1);
                    } else {
                        console.log(`⚠️ Kann API-Datum nicht parsen: "${dateStr}"`);
                        return;
                    }
                }
            }
        } else {
            // DOM Daten: Bereits geparst
            gameDate = gameDetail.parsedDate;
        }
        
        gameDate.setHours(0, 0, 0, 0);
        
        let newStatus = null;
        let statusEmoji = '';
        let dateLabel = '';
        
        if (gameDate.getTime() === today.getTime()) {
            newStatus = 'scheduled'; // Bleibt grau, aber bekommt Label
            dateLabel = 'heute';
            statusEmoji = '📅';
            todayCount++;
        } else if (gameDate.getTime() === tomorrow.getTime()) {
            newStatus = 'scheduled'; // Bleibt grau, aber bekommt Label
            dateLabel = 'morgen';
            statusEmoji = '📅';
            tomorrowCount++;
        } else if (gameDate.getTime() < today.getTime()) {
            newStatus = 'played';
            statusEmoji = '🔵';
        } else {
            newStatus = 'scheduled'; // Alle zukünftigen Spiele grau
        }
        
        if (newStatus) {
            // Update Link - alle außer gespielten sind grau
            link.classList.remove('played', 'scheduled', 'today', 'tomorrow');
            link.classList.add(newStatus);
            link.setAttribute('data-status', newStatus);
            
            // Entferne existierende Datum-Labels
            const existingLabel = match.querySelector('.date-label');
            if (existingLabel) {
                existingLabel.remove();
            }
            
            // Füge Datum-Label für heute/morgen hinzu
            if (dateLabel) {
                const label = document.createElement('div');
                label.className = 'date-label';
                label.textContent = dateLabel;
                match.appendChild(label);
            }
            
            // Update Title
            const teams = match.querySelectorAll('.team-name');
            const team1 = teams[0] ? teams[0].textContent.trim() : '';
            const team2 = teams[1] ? teams[1].textContent.trim() : '';
            
            const dateStr = source === 'API' ? gameDetail.date : gameDetail.date;
            const timeStr = gameDetail.time || '';
            
            let titlePrefix = dateLabel ? `${dateLabel.toUpperCase()} ` : '';
            link.title = `${titlePrefix}${team1} vs ${team2} | ${dateStr} ${timeStr} | Game ${gameId}`;
            
            upgradedCount++;
            
            if (dateLabel) {
                console.log(`  📅 ${team1} vs ${team2} - ${dateLabel.toUpperCase()} (${dateStr})`);
            }
        }
    });
    
    console.log(`\n✅ ${source} UPGRADE ABGESCHLOSSEN:`);
    console.log(`  🔄 ${upgradedCount} Links upgraded`);
    console.log(`  📅 ${todayCount} Spiele heute (mit Label)`);
    console.log(`  📅 ${tomorrowCount} Spiele morgen (mit Label)`);
    
    // Finale Statistik
    setTimeout(showFinalStats, 500);
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
    
    // Zähle Datum-Labels
    const todayLabels = document.querySelectorAll('.date-label').length;
    if (todayLabels > 0) {
        console.log(`  📅 HEUTE/MORGEN-LABELS: ${todayLabels}`);
    }
    
    console.log('\n✅ Smart Links Setup komplett!');
}

// Reset-Funktion für neues Bracket
function resetSmartMatchLinks() {
    lastSmartMatchCount = 0;
    console.log('🔄 Smart Match Links reset');
}

// Starte Monitoring
startBracketMonitoring();

// Exportiere Reset-Funktion
window.resetSmartMatchLinks = resetSmartMatchLinks;

console.log('👁️ Smart Links Monitoring gestartet - wartet auf Bracket...');