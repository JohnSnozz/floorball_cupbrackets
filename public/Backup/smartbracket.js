// Smart Bracket für Swiss Cup - Dynamische Abstände ohne Freilos
// =====================================================================

let currentGames = [];
let currentRounds = [];
let debugData = {};

// Konstanten
let MATCH_HEIGHT = 62; // Höhe eines einzelnen Spiels in px

function detectMatchHeight() {
    // Dummy-Match erzeugen
    const dummy = document.createElement('div');
    dummy.className = 'smart-match';
    dummy.style.visibility = 'hidden';  // unsichtbar, beeinflusst Layout nicht
    dummy.innerHTML = `
        <div class="team"><span class="team-name">A</span></div>
        <div class="team"><span class="team-name">B</span></div>
    `;
    document.body.appendChild(dummy);

    const height = dummy.getBoundingClientRect().height;
    dummy.remove();
    return height;
}

/**
 * Einheitliche Runden-Priorität für chronologische Sortierung
 */
function getUnifiedRoundPriority(roundName) {
    const name = roundName.toLowerCase().trim();

    // 1/X Format - direkt als Priorität verwenden (1/128 = früh, 1/1 = spät)
    const fractionMatch = name.match(/^1\/(\d+)$/);
    if (fractionMatch) {
        const denominator = parseInt(fractionMatch[1]);
        return Math.log2(128) - Math.log2(denominator) + 1;
    }

    // Deutsche Rundennamen
    if (name.includes('finale') && !name.includes('halb') && !name.includes('viertel') && !name.includes('achtel')) {
        return 8; // Finale = späteste Runde
    }
    if (name.includes('halbfinale')) return 7;
    if (name.includes('viertelfinale')) return 6;
    if (name.includes('achtelfinale')) return 5;

    // Numerische Runden (1. Runde, 2. Runde, etc.)
    const numberMatch = name.match(/(\d+)\./);
    if (numberMatch) {
        return parseInt(numberMatch[1]);
    }

    return 1000;
}

/**
 * Prüft ob ein Team "Freilos" ist
 */
function isFreilos(team) {
    return (team || '').toLowerCase().trim() === 'freilos';
}

/**
 * Prüft ob ein Spiel ein Freilos-Spiel ist (mindestens ein Team ist Freilos)
 */
function isFreilosGame(game) {
    return isFreilos(game.team1) || isFreilos(game.team2);
}

/**
 * Lädt die Smart Bracket Daten
 */
async function loadSmartBracket() {
    const cupType = document.getElementById('cupSelect').value;
    const season = document.getElementById('seasonSelect').value;
    const bracketContent = document.getElementById('bracketContent');
    const infoBox = document.getElementById('infoBox');
    
    bracketContent.innerHTML = '<div class="loading">⏳ Lade Smart Bracket Daten...</div>';
    infoBox.style.display = 'none';
    
    try {
        const response = await fetch(`/games?cup=${cupType}&season=${season}&limit=1000`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const games = await response.json();
        
        if (games.length === 0) {
            bracketContent.innerHTML = `
                <div class="error">
                    Keine Spiele gefunden für ${cupType} in Saison ${season}.<br>
                    Versuche zuerst die Spiele zu crawlen auf der Hauptseite.
                </div>
            `;
            return;
        }
        
        currentGames = games;
        
        // Validiere bracketSortOrder
        const validation = validateBracketSorting(games);
        if (!validation.isValid) {
            bracketContent.innerHTML = `
                <div class="error">
                    ❌ <strong>Bracket-Sortierung nicht verfügbar!</strong><br><br>
                    ${validation.message}<br><br>
                    <strong>Lösungsschritte:</strong><br>
                    1. Führe zuerst die Bracket-Sortierung aus: <code>POST /calculate-bracket-sorting</code><br>
                    2. Stelle sicher, dass alle Spiele bracketSortOrder-Werte haben
                </div>
            `;
            return;
        }
        
        // Verarbeite und berechne Smart Bracket
        const smartRounds = processSmartBracket(games);
        currentRounds = smartRounds;
        
        const totalGames = games.length;
        const nonFreilosGames = games.filter(g => !isFreilosGame(g)).length;
        const freilosGames = totalGames - nonFreilosGames;
        
        infoBox.innerHTML = `📊 ${totalGames} Spiele total • ${nonFreilosGames} echte Spiele • ${freilosGames} Freilos ausgeblendet • ${smartRounds.length} Runden`;
        infoBox.style.display = 'flex';
        
        renderSmartBracket();
        
    } catch (error) {
        console.error('Error loading smart bracket:', error);
        bracketContent.innerHTML = `
            <div class="error">
                Fehler beim Laden der Smart Bracket Daten: ${error.message}
            </div>
        `;
    }
}

/**
 * Validiert ob bracketSortOrder verfügbar ist
 */
function validateBracketSorting(games) {
    const gamesWithBracketSort = games.filter(g => 
        g.bracketSortOrder !== undefined && 
        g.bracketSortOrder !== null && 
        g.bracketSortOrder !== ''
    );
    
    const coverage = games.length > 0 ? (gamesWithBracketSort.length / games.length) * 100 : 0;
    
    if (coverage < 100) {
        return {
            isValid: false,
            message: `Nur ${gamesWithBracketSort.length}/${games.length} Spiele (${coverage.toFixed(1)}%) haben bracketSortOrder-Werte.`
        };
    }
    
    return {
        isValid: true,
        message: `Alle ${games.length} Spiele haben bracketSortOrder-Werte.`
    };
}

/**
 * Verarbeitet die Spiele zu einem Smart Bracket
 */
function processSmartBracket(games) {
    console.log('🧠 Processing Smart Bracket...');
    
    // 1. Gruppiere nach Runden und sortiere chronologisch
    const roundsMap = new Map();
    games.forEach(game => {
        const roundName = game.roundName || 'Unbekannte Runde';
        if (!roundsMap.has(roundName)) {
            roundsMap.set(roundName, []);
        }
        roundsMap.get(roundName).push(game);
    });
    
    // Sortiere Runden chronologisch (früh zu spät)
    const sortedRounds = Array.from(roundsMap.entries()).sort((a, b) => {
        return getUnifiedRoundPriority(a[0]) - getUnifiedRoundPriority(b[0]);
    });
    
    // 2. Verarbeite jede Runde und finde die maximale Spielanzahl
    const processedRounds = [];
    let maxGameCount = 0;
    let maxGameRoundIndex = -1;
    
    sortedRounds.forEach(([roundName, roundGames], roundIndex) => {
        console.log(`\n📊 Processing round ${roundIndex + 1}: ${roundName}`);
        
        // Sortiere Spiele nach bracketSortOrder
        const sortedGames = roundGames.sort((a, b) => {
            return parseInt(a.bracketSortOrder) - parseInt(b.bracketSortOrder);
        });
        
        // Filtere Freilos-Spiele raus
        const nonFreilosGames = sortedGames.filter(game => !isFreilosGame(game));
        
        console.log(`   Total games: ${sortedGames.length}, Non-Freilos: ${nonFreilosGames.length}`);
        
        if (nonFreilosGames.length === 0) {
            console.log(`   ⚠️ Round ${roundName} has no non-Freilos games, skipping`);
            return;
        }
        
        // Aktualisiere maximale Spielanzahl
        if (nonFreilosGames.length > maxGameCount) {
            maxGameCount = nonFreilosGames.length;
            maxGameRoundIndex = processedRounds.length;
        }
        
        processedRounds.push({
            name: roundName,
            games: nonFreilosGames,
            originalGameCount: sortedGames.length,
            index: roundIndex
        });
    });
    
    if (processedRounds.length === 0) {
        console.log('❌ No valid rounds found');
        return [];
    }
    
    // 3. Berechne Layout für alle Runden
    // Zuerst: Berechne das Layout der Referenz-Runde (kompakt)
    const maxGameRound = processedRounds[maxGameRoundIndex];
    const referenceLayout = calculateMaxGamesRoundLayout(maxGameRound.games, null, maxGameRound.name);
    const actualBracketHeight = referenceLayout.totalHeight;
    
    console.log(`🎯 Actual bracket height: ${actualBracketHeight}px (from max games round: ${maxGameRound.name})`);
    
    // Dann: Berechne alle anderen Runden basierend auf dieser Höhe
    const smartRounds = processedRounds.map((round, index) => {
        let roundLayout;
        if (index === maxGameRoundIndex) {
            // Verwende das bereits berechnete Layout der Referenz-Runde
            roundLayout = referenceLayout;
        } else {
            // Alle anderen Runden - dynamischer Abstand mit Zentrierung
            roundLayout = calculateCenteredRoundLayout(round.games, actualBracketHeight, round.name);
        }
        
        return {
            ...round,
            layout: roundLayout,
            isMaxGameRound: index === maxGameRoundIndex
        };
    });
    
    // Debug-Daten speichern
    debugData = {
        totalRounds: sortedRounds.length,
        smartRounds: smartRounds.length,
        maxGameCount,
        maxGameRoundIndex,
        actualBracketHeight,
        rounds: smartRounds.map(r => ({
            name: r.name,
            games: r.games.length,
            originalGames: r.originalGameCount,
            spacing: r.layout.spacing,
            topMargin: r.layout.topMargin,
            isMaxGameRound: r.isMaxGameRound,
            totalHeight: r.layout.totalHeight
        }))
    };
    
    console.log('🎯 Smart Bracket processing complete:', debugData);
    
    return smartRounds;
}

/**
 * Berechnet die kompakte Gesamthöhe des Brackets (für Referenz-Runde)
 */
function calculateCompactBracketHeight(maxGameCount) {
    return maxGameCount * MATCH_HEIGHT + (maxGameCount - 1) * 4; // 4px Abstand für kompaktes Layout
}

/**
 * Berechnet die Gesamthöhe des Brackets basierend auf der maximalen Spielanzahl
 * @deprecated - Verwende calculateCompactBracketHeight für konsistente Referenz
 */
function calculateBracketHeight(maxGameCount) {
    return calculateCompactBracketHeight(maxGameCount);
}

/**
 * Berechnet Layout für die Runde mit den meisten Spielen (fixer 4px Abstand)
 */
function calculateMaxGamesRoundLayout(games, totalHeight, roundName) {
    const gameCount = games.length;
    const spacing = 4;
    const topMargin = 0;

    const actualHeight = gameCount * MATCH_HEIGHT + (gameCount - 1) * spacing;

    const gamePositions = games.map((game, index) => ({
        game,
        top: topMargin + index * (MATCH_HEIGHT + spacing)
    }));

    return {
        totalHeight: actualHeight,
        spacing,
        topMargin,
        gamePositions
    };
}


/**
 * Berechnet Layout für andere Runden mit zentrierter Positionierung
 */
function calculateCenteredRoundLayout(games, totalHeight, roundName) {
    const gameCount = games.length;

    if (gameCount === 1) {
        const topMargin = (totalHeight - MATCH_HEIGHT) / 2;

        return {
            totalHeight,
            spacing: 0,
            topMargin,
            gamePositions: [{
                game: games[0],
                top: topMargin
            }]
        };
    }

    // Abstand korrekt verteilen
    const spacingBetweenGames = totalHeight / gameCount;
    const topMargin = spacingBetweenGames / 2;

    const gamePositions = games.map((game, index) => ({
        game,
        top: topMargin + index * (MATCH_HEIGHT + spacingBetweenGames)
    }));

    return {
        totalHeight,
        spacing: spacingBetweenGames,
        topMargin,
        gamePositions
    };
}

/**
 * Rendert das Smart Bracket
 */
function renderSmartBracket() {
    const bracketContent = document.getElementById('bracketContent');
    
    if (currentRounds.length === 0) {
        bracketContent.innerHTML = '<div class="error">Keine Runden mit echten Spielen gefunden</div>';
        return;
    }
    
    console.log('🎨 Starting smart bracket render...');
    
    let html = '<div class="smart-bracket">';
    
    currentRounds.forEach((round, roundIndex) => {
        html += `
            <div class="smart-round smart-round-${roundIndex + 1}">
                <div class="smart-round-header">
                    ${round.name}
                    <span class="smart-round-count">(${round.games.length}/${round.originalGameCount} Spiele)</span>
                </div>
                <div class="smart-round-matches" style="position: relative; height: ${round.layout.totalHeight}px;">
        `;
        
        round.layout.gamePositions.forEach((position, gameIndex) => {
            html += renderSmartMatch(position.game, position.top, gameIndex);
        });
        
        html += '</div></div>';
    });
    
    html += '</div>';
    
    bracketContent.innerHTML = html;
    console.log('✅ Smart bracket HTML rendered');
    
    // Verhindere weitere Layout-Änderungen durch sofortiges "Einfrieren" der Positionen
    setTimeout(() => {
        freezeMatchPositions();
    }, 50);
    
    // Initialisiere alle Features nach dem Rendern - OHNE weitere Layout-Änderungen
    setTimeout(() => {
        console.log('🔧 Initializing additional features...');
        
        adjustLongTeamNames();
        
        // Team Highlighting initialisieren
        if (typeof initializeTeamHighlighting === 'function') {
            console.log('🎯 Initializing team highlighting...');
            initializeTeamHighlighting();
        }
        
        // Smart Match Links initialisieren (spezielle Funktion für Smart Bracket)
        if (typeof initializeSmartMatchLinks === 'function') {
            console.log('🔗 Initializing smart match links...');
            initializeSmartMatchLinks();
        }
        
        // Smart Predictions NICHT automatisch initialisieren - nur manuell
        console.log('✅ All features initialized (predictions available via manual call)');
    }, 100);
}

/**
 * Friert die Match-Positionen ein, um weitere Layout-Änderungen zu verhindern
 */
function freezeMatchPositions() {
    console.log('🔒 Freezing match positions...');
    
    const smartMatches = document.querySelectorAll('.smart-match');
    let frozenCount = 0;
    
    smartMatches.forEach(match => {
        const currentStyle = match.getAttribute('style');
        if (currentStyle) {
            // Entferne Event Listener und mache das Element "read-only"
            match.style.pointerEvents = 'auto'; // Behalte Interaktivität
            match.setAttribute('data-frozen-style', currentStyle);
            frozenCount++;
        }
    });
    
    console.log(`✅ Frozen ${frozenCount} match positions`);
    
    // Observer um zu verhindern, dass style-Attribute verändert werden
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && 
                mutation.attributeName === 'style' && 
                mutation.target.classList.contains('smart-match')) {
                
                const frozenStyle = mutation.target.getAttribute('data-frozen-style');
                const currentStyle = mutation.target.getAttribute('style');
                
                if (frozenStyle && currentStyle !== frozenStyle) {
                    console.log('🛑 Preventing style change on frozen match');
                    mutation.target.setAttribute('style', frozenStyle);
                }
            }
        });
    });
    
    // Beobachte alle Smart Matches
    smartMatches.forEach(match => {
        observer.observe(match, { 
            attributes: true,
            attributeFilter: ['style']
        });
    });
    
    return observer;
}

/**
 * Rendert ein einzelnes Match mit absoluter Positionierung
 */
function renderSmartMatch(game, topPosition, gameIndex) {
    const team1Winner = isWinner(game, game.team1);
    const team2Winner = isWinner(game, game.team2);
    const hasResult = game.result && game.result.trim() && game.result !== 'TBD';
    
    const style = `position: absolute; top: ${topPosition}px; left: 0; right: 0;`;
    const gameIdInfo = `data-game-id="${game.numericGameId || ''}"`;
    const bracketInfo = `data-bracket-sort="${game.bracketSortOrder}"`;
    
    let html = `<div class="smart-match" style="${style}" ${gameIdInfo} ${bracketInfo}
                     title="Game: ${game.gameId} | numericGameId: ${game.numericGameId} | bracketSortOrder: ${game.bracketSortOrder}">`;
    
    if (!hasResult) {
        // Noch nicht gespielt
        html += renderTBDMatch(game);
    } else {
        // Gespieltes Spiel mit Resultat
        html += renderFinishedMatch(game, team1Winner, team2Winner);
    }
    
    html += '</div>';
    return html;
}

/**
 * Rendert ein TBD Match
 */
function renderTBDMatch(game) {
    return `
        <div class="team tbd">
            <span class="team-name">${game.team1 || 'TBD'}</span>
        </div>
        <div class="team tbd">
            <span class="team-name">${game.team2 || 'TBD'}</span>
        </div>
    `;
}

/**
 * Rendert ein beendetes Match
 */
function renderFinishedMatch(game, team1Winner, team2Winner) {
    const scores = parseScore(game.result);
    
    return `
        <div class="team ${team1Winner ? 'winner' : ''}">
            <span class="team-name">${game.team1}</span>
            <span class="team-score">${scores.team1}</span>
        </div>
        <div class="team ${team2Winner ? 'winner' : ''}">
            <span class="team-name">${game.team2}</span>
            <span class="team-score">${scores.team2}</span>
        </div>
    `;
}

/**
 * Prüft ob ein Team Gewinner ist
 */
function isWinner(game, teamName) {
    if (!game.result || !game.result.trim() || game.result === 'TBD') {
        return false;
    }
    
    const scores = parseScore(game.result);
    if (!scores) return false;
    
    const team1Score = parseInt(scores.team1) || 0;
    const team2Score = parseInt(scores.team2) || 0;
    
    if (team1Score === team2Score) return false;
    
    if (teamName === game.team1) {
        return team1Score > team2Score;
    } else if (teamName === game.team2) {
        return team2Score > team1Score;
    }
    
    return false;
}

/**
 * Parsed Score aus Result-String
 */
function parseScore(resultString) {
    if (!resultString || resultString.trim() === '' || resultString === 'TBD') {
        return { team1: 'TBD', team2: 'TBD' };
    }
    
    const scoreMatch = resultString.match(/(\d+)[\s\-:]+(\d+)/);
    
    if (scoreMatch) {
        return {
            team1: scoreMatch[1],
            team2: scoreMatch[2]
        };
    }
    
    return { team1: resultString, team2: '' };
}

/**
 * Passt lange Team-Namen an
 */
function adjustLongTeamNames() {
    const teamNames = document.querySelectorAll('.team-name');
    teamNames.forEach(nameElement => {
        const text = nameElement.textContent;
        if (text.length > 15 || text.includes(' ')) {
            nameElement.classList.add('long-name');
        }
    });
}

/**
 * Zeigt Debug-Informationen
 */
function showDebugInfo() {
    if (!debugData || Object.keys(debugData).length === 0) {
        alert('Keine Debug-Daten verfügbar. Lade zuerst ein Smart Bracket.');
        return;
    }
    
    let debugText = `🧠 Smart Bracket Debug Info\n`;
    debugText += `================================\n\n`;
    debugText += `📊 Gesamt-Statistik:\n`;
    debugText += `   Total Runden: ${debugData.totalRounds}\n`;
    debugText += `   Smart Runden: ${debugData.smartRounds}\n`;
    debugText += `   Max Games: ${debugData.maxGameCount} (Runde ${debugData.maxGameRoundIndex + 1})\n`;
    debugText += `   Bracket-Höhe: ${debugData.actualBracketHeight}px\n\n`;
    
    debugText += `🎯 Runden-Details:\n`;
    debugData.rounds.forEach((round, index) => {
        const marker = round.isMaxGameRound ? '⭐ ' : '   ';
        debugText += `${marker}${index + 1}. ${round.name}:\n`;
        debugText += `      Spiele: ${round.games}/${round.originalGames} (${round.originalGames - round.games} Freilos ausgeblendet)\n`;
        debugText += `      Abstand: ${round.spacing.toFixed(1)}px\n`;
        debugText += `      Top Margin: ${round.topMargin.toFixed(1)}px\n`;
        debugText += `      Max Game Round: ${round.isMaxGameRound ? 'JA' : 'NEIN'}\n\n`;
    });
    
    // Zeige Debug-Info in einem neuen Element
    const existing = document.querySelector('.debug-info');
    if (existing) {
        existing.remove();
    }
    
    const debugDiv = document.createElement('div');
    debugDiv.className = 'debug-info';
    debugDiv.textContent = debugText;
    
    const infoBox = document.getElementById('infoBox');
    infoBox.parentNode.insertBefore(debugDiv, infoBox.nextSibling);
    
    console.log('🔍 Debug Data:', debugData);
}

/**
 * Debug-Funktionen für Konsole
 */
function debugSmartBracket() {
    console.log('\n🔍 DEBUG: Smart Bracket Structure');
    currentRounds.forEach((round, index) => {
        console.log(`\n📊 Round ${index + 1}: ${round.name} ${round.isMaxGameRound ? '⭐ MAX' : ''}`);
        console.log(`   Games: ${round.games.length}/${round.originalGameCount}`);
        console.log(`   Layout:`, round.layout);
        round.games.forEach((game, gameIndex) => {
            console.log(`   ${gameIndex + 1}. ${game.team1} vs ${game.team2} | bracketSortOrder: ${game.bracketSortOrder}`);
        });
    });
}

function debugSmartMatchPositions() {
    console.log('\n🔍 CURRENT Smart Match Positions:');
    const smartMatches = document.querySelectorAll('.smart-match');
    
    smartMatches.forEach((match, index) => {
        const style = match.getAttribute('style');
        const frozenStyle = match.getAttribute('data-frozen-style');
        const roundElement = match.closest('.smart-round');
        const roundHeader = roundElement ? roundElement.querySelector('.smart-round-header').textContent.trim() : 'Unknown';
        
        console.log(`${index + 1}. ${roundHeader}:`);
        console.log(`   Current: ${style}`);
        if (frozenStyle) {
            console.log(`   Frozen:  ${frozenStyle}`);
        }
    });
    
    return smartMatches.length;
}

/**
 * Erweitert das Smart Bracket um Prognose-Runden
 */
function addPredictionRounds() {
    if (!currentRounds || currentRounds.length === 0) {
        console.log('❌ No current rounds available for prediction');
        alert('Bitte zuerst Smart Bracket laden!');
        return;
    }
    
    // Verhindere mehrfaches Hinzufügen
    if (currentRounds.some(r => r.isPrediction)) {
        console.log('⚠️ Prediction rounds already exist');
        alert('Prognose-Runden sind bereits vorhanden!');
        return;
    }
    
    console.log('🔮 Starting prediction generation...');
    
    // Bestimme welche Runden für Prognose benötigt werden
    const missingRounds = findMissingRounds();
    if (missingRounds.length === 0) {
        console.log('ℹ️ No missing rounds to predict');
        alert('Keine fehlenden Runden für Prognose gefunden.');
        return;
    }
}


// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Auto-load kann aktiviert werden falls gewünscht
    // loadSmartBracket();
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        loadSmartBracket();
    }
    
    if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        debugSmartBracket();
        showDebugInfo();
    }
});

// Globale Debug-Funktionen
window.debugSmartBracket = debugSmartBracket;
window.showDebugInfo = showDebugInfo;
window.loadSmartBracket = loadSmartBracket;
window.debugSmartMatchPositions = debugSmartMatchPositions;