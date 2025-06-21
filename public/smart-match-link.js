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
    
    smartMatches.forEach((match) => {
        // Prüfe ob bereits ein Link existiert
        if (match.querySelector('.smart-match-link')) return;
        
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
        
        // URL und Attribute
        const gameId = match.getAttribute('data-game-id');
        if (gameId && gameId !== '' && gameId !== 'null') {
            link.href = `https://www.swissunihockey.ch/de/game-detail?game_id=${gameId}`;
            link.target = '_blank';
        } else {
            link.href = '#';
            link.addEventListener('click', e => e.preventDefault());
        }
        
        link.setAttribute('data-status', status);
        if (gameId) link.setAttribute('data-game-id', gameId);
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
    
    // Nach kurzer Verzögerung versuche Upgrade mit gameDetails
    setTimeout(() => {
        if (createdLinks > 0) {
            tryUpgradeWithGameDetails();
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
        console.log('🔄 Versuche Upgrade mit gameDetails...');
        tryUpgradeWithGameDetails();
    }
}

function tryUpgradeWithGameDetails() {
    console.log('\n📊 Teste gameDetails API...');
    
    fetch('/api/game-details?limit=3')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(testData => {
            console.log(`✅ gameDetails API verfügbar: ${testData.length} Test-Einträge`);
            
            if (testData.length > 0) {
                console.log('📋 Sample Data:');
                testData.forEach((item, i) => {
                    console.log(`  ${i+1}. GameID ${item.numericGameId}: ${item.home_name} vs ${item.away_name} | Datum: ${item.date}`);
                });
                
                // Lade vollständige Daten
                loadGameDetailsAndUpgrade();
            }
        })
        .catch(error => {
            console.log('❌ gameDetails API nicht verfügbar:', error.message);
            console.log('💡 Verwende Basic Links ohne Datum-Features');
        });
}

function loadGameDetailsAndUpgrade() {
    console.log('\n🔄 Lade gameDetails für Upgrade...');
    
    fetch('/api/game-details?limit=1000')
        .then(response => response.json())
        .then(gameDetails => {
            console.log(`📋 ${gameDetails.length} gameDetails geladen`);
            
            upgradeLinksWithDates(gameDetails);
        })
        .catch(error => {
            console.log('❌ Fehler beim Laden der gameDetails:', error);
        });
}

function upgradeLinksWithDates(gameDetails) {
    console.log('\n🎯 UPGRADE LINKS MIT DATUM-LOGIC...');
    
    // Cache erstellen
    const gameCache = new Map();
    gameDetails.forEach(detail => {
        gameCache.set(detail.numericGameId, detail);
    });
    
    console.log(`🗂️ Cache erstellt mit ${gameCache.size} Einträgen`);
    
    // Heutige und morgige Daten (Schweizer Zeit)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    console.log(`📅 Heute: ${today.toLocaleDateString('de-CH')}`);
    console.log(`📅 Morgen: ${tomorrow.toLocaleDateString('de-CH')}`);
    
    const smartMatches = document.querySelectorAll('.smart-match-absolute');
    let upgradedCount = 0;
    let todayCount = 0;
    let tomorrowCount = 0;
    
    smartMatches.forEach(match => {
        const gameId = match.getAttribute('data-game-id');
        const link = match.querySelector('.smart-match-link');
        
        if (!gameId || !link || !gameCache.has(gameId)) return;
        
        const gameDetail = gameCache.get(gameId);
        const dateStr = gameDetail.date;
        
        if (!dateStr || dateStr.trim() === '') return;
        
        // Parse DD.MM.YYYY Format
        const dateMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (!dateMatch) {
            console.log(`⚠️ Kann Datum nicht parsen: "${dateStr}"`);
            return;
        }
        
        const day = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]) - 1; // JS Monate sind 0-basiert
        const year = parseInt(dateMatch[3]);
        const gameDate = new Date(year, month, day);
        gameDate.setHours(0, 0, 0, 0);
        
        let newStatus = null;
        let statusEmoji = '';
        
        if (gameDate.getTime() === today.getTime()) {
            newStatus = 'today';
            statusEmoji = '🔴';
            todayCount++;
        } else if (gameDate.getTime() === tomorrow.getTime()) {
            newStatus = 'tomorrow';
            statusEmoji = '🟡';
            tomorrowCount++;
        } else if (gameDate.getTime() < today.getTime()) {
            newStatus = 'played';
            statusEmoji = '🔵';
        }
        // Zukunft bleibt 'scheduled'
        
        if (newStatus) {
            // Update Link
            link.classList.remove('played', 'scheduled', 'today', 'tomorrow');
            link.classList.add(newStatus);
            link.setAttribute('data-status', newStatus);
            
            // Update Title
            const teams = match.querySelectorAll('.team-name');
            const team1 = teams[0] ? teams[0].textContent.trim() : '';
            const team2 = teams[1] ? teams[1].textContent.trim() : '';
            
            link.title = `${statusEmoji} ${team1} vs ${team2} | ${dateStr} ${gameDetail.time || ''} | Game ${gameId}`;
            
            upgradedCount++;
            
            if (newStatus === 'today' || newStatus === 'tomorrow') {
                console.log(`  ${statusEmoji} ${team1} vs ${team2} - ${newStatus.toUpperCase()} (${dateStr})`);
            }
        }
    });
    
    console.log(`\n✅ UPGRADE ABGESCHLOSSEN:`);
    console.log(`  🔄 ${upgradedCount} Links upgraded`);
    console.log(`  🔴 ${todayCount} Spiele heute`);
    console.log(`  🟡 ${tomorrowCount} Spiele morgen`);
    
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
        const emoji = { 'played': '🔵', 'scheduled': '⚪', 'today': '🔴', 'tomorrow': '🟡' }[status] || '❓';
        console.log(`  ${emoji} ${status.toUpperCase()}: ${count} Links`);
    });
    console.log('\n✅ Smart Links Setup komplett!');
}

// Starte Monitoring
startBracketMonitoring();

console.log('👁️ Smart Links Monitoring gestartet - wartet auf Bracket...');