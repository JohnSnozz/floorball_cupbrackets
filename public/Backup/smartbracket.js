// Smart Bracket für Swiss Cup - Absolute Koordinaten System
// =====================================================================

let currentGames = [];
let currentRounds = [];
let debugData = {};

// Konstanten
const MATCH_HEIGHT = 62; // Höhe eines einzelnen Spiels in px
const ROUND_WIDTH = 180; // Breite einer Runde in px
const ROUND_GAP = 40; // Horizontaler Abstand zwischen Runden in px
const TOTAL_ROUND_SPACING = ROUND_WIDTH + ROUND_GAP; // 220px

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
        
        // Verarbeite und berechne Smart Bracket mit absoluten Koordinaten
        const smartRounds = processSmartBracketAbsolute(games);
        currentRounds = smartRounds;
        
        const totalGames = games.length;
        const nonFreilosGames = games.filter(g => !isFreilosGame(g)).length;
        const freilosGames = totalGames - nonFreilosGames;
        
        infoBox.innerHTML = `📊 ${totalGames} Spiele total • ${nonFreilosGames} echte Spiele • ${freilosGames} Freilos ausgeblendet • ${smartRounds.length} Runden`;
        infoBox.style.display = 'flex';
        
        renderSmartBracketAbsolute();
        
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
 * Verarbeitet die Spiele zu einem Smart Bracket mit absoluten Koordinaten
 */
function processSmartBracketAbsolute(games) {
    console.log('🧠 Processing Smart Bracket with absolute coordinates...');
    
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
            allGames: sortedGames, // Behalte alle Spiele für Vorgänger-Analyse
            originalGameCount: sortedGames.length,
            index: roundIndex
        });
    });
    
    if (processedRounds.length === 0) {
        console.log('❌ No valid rounds found');
        return [];
    }
    
    // 3. Berechne maximale Bracket-Höhe basierend auf der Max-Games-Runde
    const maxBracketHeight = calculateCompactBracketHeight(maxGameCount);
    console.log(`🎯 Max bracket height: ${maxBracketHeight}px (from ${maxGameCount} games)`);
    
    // 4. Berechne absolute Koordinaten für alle Runden
    const smartRounds = [];
    
    for (let roundIndex = 0; roundIndex < processedRounds.length; roundIndex++) {
        const round = processedRounds[roundIndex];
        const roundX = roundIndex * TOTAL_ROUND_SPACING; // Horizontale Position
        let gamePositions;
        
        if (roundIndex === maxGameRoundIndex) {
            // Max-Games-Runde: Kompakte Anordnung mit 4px Abstand
            gamePositions = calculateMaxGamesAbsolutePositions(round.games, roundX);
            // Für Max-Games-Runde: Erstelle auch allGamePositions für Freilos-Tracking
            const allGamePositions = createAllGamePositions(round.allGames, round.games, gamePositions);
            smartRounds.push({
                ...round,
                gamePositions,
                allGamePositions, // Neue Struktur für Freilos-Tracking
                isMaxGameRound: true,
                roundX
            });
        } else if (roundIndex < maxGameRoundIndex) {
            // Runden VOR der Max-Games-Runde: Gleichmäßig über maximale Höhe verteilt
            gamePositions = calculatePreMaxRoundAbsolutePositions(round.games, roundX, maxBracketHeight);
            const allGamePositions = createAllGamePositions(round.allGames, round.games, gamePositions);
            smartRounds.push({
                ...round,
                gamePositions,
                allGamePositions,
                isMaxGameRound: false,
                roundX
            });
        } else {
            // Runden NACH der Max-Games-Runde: Alle mit vereinfachter Bracket-Logik
            const previousRound = smartRounds[roundIndex - 1];
            console.log(`   🧪 Testing bracket logic for post-max round: ${round.name}`);
            gamePositions = calculatePostMaxRoundAbsolutePositions(round, previousRound, roundX);
            
            smartRounds.push({
                ...round,
                gamePositions,
                isMaxGameRound: false,
                roundX
            });
        }
    }
    
    // Debug-Daten speichern
    debugData = {
        totalRounds: sortedRounds.length,
        smartRounds: smartRounds.length,
        maxGameCount,
        maxGameRoundIndex,
        maxBracketHeight,
        rounds: smartRounds.map(r => ({
            name: r.name,
            games: r.games.length,
            originalGames: r.originalGameCount,
            isMaxGameRound: r.isMaxGameRound,
            roundX: r.roundX,
            gamePositions: r.gamePositions.length
        }))
    };
    
    console.log('🎯 Smart Bracket absolute coordinates processing complete:', debugData);
    
    return smartRounds;
}

/**
 * Erstellt allGamePositions Array mit Freilos-Tracking
 */
function createAllGamePositions(allGames, visibleGames, visibleGamePositions) {
    return allGames.map((game, index) => {
        const isVisible = !isFreilosGame(game);
        
        if (isVisible) {
            // Finde entsprechende Position im visibleGamePositions Array
            const visibleIndex = visibleGames.findIndex(vGame => 
                vGame.bracketSortOrder === game.bracketSortOrder
            );
            if (visibleIndex >= 0 && visibleIndex < visibleGamePositions.length) {
                return {
                    ...visibleGamePositions[visibleIndex],
                    isVisible: true,
                    originalIndex: index
                };
            }
        }
        
        // Freilos-Spiel: Position wird nicht verwendet, aber Index gespeichert
        return {
            game,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            isVisible: false,
            originalIndex: index
        };
    });
}

/**
 * Berechnet die kompakte Gesamthöhe des Brackets (für Max-Games-Runde)
 */
function calculateCompactBracketHeight(maxGameCount) {
    return maxGameCount * MATCH_HEIGHT + (maxGameCount - 1) * 4; // 4px Abstand für kompaktes Layout
}

/**
 * Berechnet absolute Positionen für die Max-Games-Runde (kompakt mit 4px Abstand)
 */
function calculateMaxGamesAbsolutePositions(games, roundX) {
    console.log(`   📏 Max games round: ${games.length} games at x=${roundX}px (compact layout)`);
    
    return games.map((game, index) => ({
        game,
        x: roundX,
        y: index * (MATCH_HEIGHT + 4), // 4px Abstand
        width: ROUND_WIDTH,
        height: MATCH_HEIGHT
    }));
}

/**
 * Berechnet absolute Positionen für Runden VOR der Max-Games-Runde (gleichmäßig verteilt)
 */
function calculatePreMaxRoundAbsolutePositions(games, roundX, maxBracketHeight) {
    console.log(`   📏 Pre-max round: ${games.length} games at x=${roundX}px (distributed over ${maxBracketHeight}px)`);
    
    if (games.length === 1) {
        // Ein Spiel: Mittig platzieren
        const y = (maxBracketHeight - MATCH_HEIGHT) / 2;
        return [{
            game: games[0],
            x: roundX,
            y: y,
            width: ROUND_WIDTH,
            height: MATCH_HEIGHT
        }];
    }
    
    // Mehrere Spiele: Gleichmäßig über die verfügbare Höhe verteilen
    const availableHeight = maxBracketHeight - MATCH_HEIGHT;
    const spacing = availableHeight / (games.length - 1);
    
    return games.map((game, index) => ({
        game,
        x: roundX,
        y: index * spacing,
        width: ROUND_WIDTH,
        height: MATCH_HEIGHT
    }));
}

/**
 * Berechnet absolute Positionen für Runden NACH der Max-Games-Runde (basierend auf Vorgängerspielen)
 */
function calculatePostMaxRoundAbsolutePositions(currentRound, previousRound, roundX) {
    console.log(`   📏 Post-max round: ${currentRound.games.length} games at x=${roundX}px (based on predecessors)`);
    
    return currentRound.games.map((game, index) => {
        // Finde Y-Koordinaten aller Vorgängerspiele mit Freilos-Behandlung
        const predecessorInfo = findPredecessorGamesWithFreilos(game, currentRound, previousRound);
        
        let y;
        if (predecessorInfo.hasFreilos) {
            // Variante 2: Mindestens ein Vorgängerspiel hat Freilos
            // Positioniere auf gleicher Höhe wie das Spiel ohne Freilos
            y = predecessorInfo.nonFreilosY;
            console.log(`     Game ${index + 1}: Freilos detected, using non-Freilos position y=${y}px`);
        } else if (predecessorInfo.validYs.length > 0) {
            // Variante 1: Kein Freilos in Vorgängerspielen
            // Berechne Mittelwert aller Vorgänger-Y-Koordinaten
            y = predecessorInfo.validYs.reduce((sum, yCoord) => sum + yCoord, 0) / predecessorInfo.validYs.length;
            console.log(`     Game ${index + 1}: No Freilos, average of [${predecessorInfo.validYs.join(', ')}] → y=${y}px`);
        } else {
            // Fallback: Gleichmäßig verteilen (sollte nicht vorkommen)
            console.warn(`⚠️ Game ${index + 1}: No valid predecessors found, using fallback positioning`);
            y = index * (MATCH_HEIGHT + 10);
        }
        
        return {
            game,
            x: roundX,
            y: y,
            width: ROUND_WIDTH,
            height: MATCH_HEIGHT
        };
    });
}

/**
 * Findet die Vorgängerspiele für ein gegebenes Spiel mit Freilos-Behandlung
 */
function findPredecessorGamesWithFreilos(currentGame, currentRound, previousRound) {
    // Finde Index des aktuellen Spiels in der aktuellen Runde (0-basiert)
    const currentGameIndex = currentRound.games.findIndex(game => 
        game.bracketSortOrder === currentGame.bracketSortOrder
    );
    
    console.log(`   🔍 Current game index: ${currentGameIndex} (bracketSortOrder: ${currentGame.bracketSortOrder})`);
    console.log(`   📋 Previous round has ${previousRound.allGamePositions ? previousRound.allGamePositions.length : previousRound.gamePositions.length} total games`);
    
    // Berechne die Indizes der Vorgängerspiele (1-basiert zu 0-basiert konvertiert)
    const currentIndex1Based = currentGameIndex + 1; // Zu 1-basiert
    const pred1Index = (currentIndex1Based - 1) * 2 + 1; // 1-basiert
    const pred2Index = (currentIndex1Based - 1) * 2 + 2; // 1-basiert
    
    // Konvertiere zurück zu 0-basiert für Array-Zugriff
    const pred1ArrayIndex = pred1Index - 1;
    const pred2ArrayIndex = pred2Index - 1;
    
    console.log(`   🎯 Looking for predecessors: Game ${pred1Index} and ${pred2Index} (array indices: ${pred1ArrayIndex}, ${pred2ArrayIndex})`);
    
    // Verwende allGamePositions falls verfügbar (für Freilos-Behandlung), sonst gamePositions
    const gamePositions = previousRound.allGamePositions || previousRound.gamePositions;
    
    let hasFreilos = false;
    let nonFreilosY = null;
    const validYs = [];
    
    // Prüfe erstes Vorgängerspiel
    if (pred1ArrayIndex >= 0 && pred1ArrayIndex < gamePositions.length) {
        const pred1Position = gamePositions[pred1ArrayIndex];
        
        if (previousRound.allGamePositions) {
            // Verwende allGamePositions Struktur
            if (pred1Position.isVisible) {
                validYs.push(pred1Position.y);
                if (nonFreilosY === null) nonFreilosY = pred1Position.y;
                console.log(`     ✅ Predecessor 1: visible, y=${pred1Position.y}px`);
            } else {
                hasFreilos = true;
                console.log(`     ❌ Predecessor 1: Freilos game (hidden)`);
            }
        } else {
            // Fallback: Verwende gamePositions direkt
            validYs.push(pred1Position.y);
            if (nonFreilosY === null) nonFreilosY = pred1Position.y;
            console.log(`     ✅ Predecessor 1: y=${pred1Position.y}px`);
        }
    } else {
        console.log(`     ❌ Predecessor 1: Index ${pred1ArrayIndex} out of range (max: ${gamePositions.length - 1})`);
    }
    
    // Prüfe zweites Vorgängerspiel
    if (pred2ArrayIndex >= 0 && pred2ArrayIndex < gamePositions.length) {
        const pred2Position = gamePositions[pred2ArrayIndex];
        
        if (previousRound.allGamePositions) {
            // Verwende allGamePositions Struktur
            if (pred2Position.isVisible) {
                validYs.push(pred2Position.y);
                if (nonFreilosY === null) nonFreilosY = pred2Position.y;
                console.log(`     ✅ Predecessor 2: visible, y=${pred2Position.y}px`);
            } else {
                hasFreilos = true;
                console.log(`     ❌ Predecessor 2: Freilos game (hidden)`);
            }
        } else {
            // Fallback: Verwende gamePositions direkt
            validYs.push(pred2Position.y);
            if (nonFreilosY === null) nonFreilosY = pred2Position.y;
            console.log(`     ✅ Predecessor 2: y=${pred2Position.y}px`);
        }
    } else {
        console.log(`     ❌ Predecessor 2: Index ${pred2ArrayIndex} out of range (max: ${gamePositions.length - 1})`);
    }
    
    console.log(`     📊 Result: hasFreilos=${hasFreilos}, validYs=[${validYs.join(', ')}], nonFreilosY=${nonFreilosY}`);
    
    return {
        hasFreilos,
        validYs,
        nonFreilosY: nonFreilosY || (validYs.length > 0 ? validYs[0] : 0)
    };
}

/**
 * Rendert das Smart Bracket mit absoluten Koordinaten
 */
function renderSmartBracketAbsolute() {
    const bracketContent = document.getElementById('bracketContent');
    
    if (currentRounds.length === 0) {
        bracketContent.innerHTML = '<div class="error">Keine Runden mit echten Spielen gefunden</div>';
        return;
    }
    
    console.log('🎨 Starting smart bracket render with absolute coordinates...');
    
    // Berechne gesamte Bracket-Dimensionen
    const totalWidth = currentRounds.length * TOTAL_ROUND_SPACING;
    const totalHeight = debugData.maxBracketHeight;
    
    let html = '';
    
    // Headers Container
    html += '<div class="bracket-headers">';
    currentRounds.forEach((round, roundIndex) => {
        const nonFreilosCount = round.games.length;
        const totalCount = round.originalGameCount;
        html += `
            <div class="round-header">
                ${round.name}
                <span class="round-count">(${nonFreilosCount} Spiele)</span>
            </div>
        `;
    });
    html += '</div>';
    
    // Bracket Container mit absoluten Koordinaten
    html += `<div class="smart-bracket-absolute" style="position: relative; width: ${totalWidth}px; height: ${totalHeight}px; margin: 0 auto;">`;
    
    // Rendere alle Spiele mit absoluten Koordinaten
    currentRounds.forEach((round, roundIndex) => {
        round.gamePositions.forEach((position, gameIndex) => {
            html += renderAbsoluteMatch(position, roundIndex, gameIndex);
        });
    });
    
    html += '</div>';
    
    bracketContent.innerHTML = html;
    console.log('✅ Smart bracket HTML rendered with absolute coordinates and headers');
    
    // CSS für die Headers dynamisch hinzufügen (falls nicht in smartbracket.css)
    if (!document.querySelector('#smart-bracket-headers-css')) {
        const style = document.createElement('style');
        style.id = 'smart-bracket-headers-css';
        style.textContent = `
            /* Bracket Headers Container für Smart Bracket */
            .bracket-headers {
                display: flex;
                gap: 40px;
                margin-bottom: 15px;
                padding: 0 15px;
                position: sticky;
                top: 0;
                background-color: #2d2d2d;
                z-index: 10;
            }

            .bracket-headers .round-header {
                min-width: 180px;
                width: 180px;
                text-align: center;
                font-weight: 600;
                color: #ff6b00;
                text-transform: uppercase;
                letter-spacing: 1px;
                font-size: 14px;
                padding: 8px;
                background-color: #333;
                border-radius: 4px;
                position: relative;
            }

            .bracket-headers .round-count {
                display: block;
                font-size: 10px;
                color: #bbb;
                font-weight: 400;
                text-transform: none;
                letter-spacing: 0;
                margin-top: 3px;
            }

            /* Smart Bracket Absolute Container */
            .smart-bracket-absolute {
                background-image: 
                    linear-gradient(to right, rgba(255, 107, 0, 0.1) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(255, 107, 0, 0.1) 1px, transparent 1px);
                background-size: 20px 20px;
                background-position: 0 0;
                padding: 15px;
            }

            /* Smart Match Absolute */
            .smart-match-absolute {
                background-color: #333;
                border-radius: 4px;
                overflow: hidden;
                border: 1px solid #444;
                transition: all 0.2s;
                display: flex;
                flex-direction: column;
            }

            .smart-match-absolute:hover {
                border-color: #555;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            }

            /* Responsive Header-Skalierung */
            @media (max-width: 1400px) {
                .bracket-headers {
                    transform: scale(0.85);
                    transform-origin: top left;
                }
            }

            @media (max-width: 1200px) {
                .bracket-headers {
                    transform: scale(0.7);
                    transform-origin: top left;
                }
            }

            @media (max-width: 1000px) {
                .bracket-headers {
                    transform: scale(0.6);
                    transform-origin: top left;
                }
            }

            @media (max-width: 800px) {
                .bracket-headers {
                    transform: scale(0.5);
                    transform-origin: top left;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Initialisiere Features nach dem Rendern
    setTimeout(() => {
        console.log('🔧 Initializing additional features...');
        
        adjustLongTeamNames();
        
        // Team Highlighting initialisieren
        if (typeof initializeTeamHighlighting === 'function') {
            console.log('🎯 Initializing team highlighting...');
            initializeTeamHighlighting();
        }
        
        // Smart Match Links initialisieren
        if (typeof initializeSmartMatchLinks === 'function') {
            console.log('🔗 Initializing smart match links...');
            initializeSmartMatchLinks();
        }
        
        console.log('✅ All features initialized');
    }, 100);
}

/**
 * Rendert ein einzelnes Match mit absoluten Koordinaten
 */
function renderAbsoluteMatch(position, roundIndex, gameIndex) {
    const { game, x, y, width, height } = position;
    const team1Winner = isWinner(game, game.team1);
    const team2Winner = isWinner(game, game.team2);
    const hasResult = game.result && game.result.trim() && game.result !== 'TBD';
    
    const style = `position: absolute; top: ${y}px; left: ${x}px; width: ${width}px; height: ${height}px;`;
    const gameIdInfo = `data-game-id="${game.numericGameId || ''}"`;
    const bracketInfo = `data-bracket-sort="${game.bracketSortOrder}"`;
    const positionInfo = `data-position="${x},${y}"`;
    
    let html = `<div class="smart-match-absolute" style="${style}" ${gameIdInfo} ${bracketInfo} ${positionInfo}
                     title="Game: ${game.gameId} | numericGameId: ${game.numericGameId} | bracketSortOrder: ${game.bracketSortOrder} | Position: (${x}, ${y})">`;
    
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
    
    let debugText = `🧠 Smart Bracket Debug Info (Absolute Coordinates)\n`;
    debugText += `=======================================================\n\n`;
    debugText += `📊 Gesamt-Statistik:\n`;
    debugText += `   Total Runden: ${debugData.totalRounds}\n`;
    debugText += `   Smart Runden: ${debugData.smartRounds}\n`;
    debugText += `   Max Games: ${debugData.maxGameCount} (Runde ${debugData.maxGameRoundIndex + 1})\n`;
    debugText += `   Bracket-Höhe: ${debugData.maxBracketHeight}px\n\n`;
    
    debugText += `🎯 Runden-Details:\n`;
    debugData.rounds.forEach((round, index) => {
        const marker = round.isMaxGameRound ? '⭐ ' : '   ';
        debugText += `${marker}${index + 1}. ${round.name}:\n`;
        debugText += `      Spiele: ${round.games}/${round.originalGames} (${round.originalGames - round.games} Freilos ausgeblendet)\n`;
        debugText += `      X-Position: ${round.roundX}px\n`;
        debugText += `      Game Positions: ${round.gamePositions}\n`;
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
    console.log('\n🔍 DEBUG: Smart Bracket Structure (Absolute Coordinates)');
    currentRounds.forEach((round, index) => {
        console.log(`\n📊 Round ${index + 1}: ${round.name} ${round.isMaxGameRound ? '⭐ MAX' : ''}`);
        console.log(`   Games: ${round.games.length}/${round.originalGameCount}`);
        console.log(`   Round X: ${round.roundX}px`);
        console.log(`   Game Positions:`);
        round.gamePositions.forEach((pos, gameIndex) => {
            console.log(`     ${gameIndex + 1}. ${pos.game.team1} vs ${pos.game.team2} | Position: (${pos.x}, ${pos.y}) | Size: ${pos.width}x${pos.height}`);
        });
    });
}

function debugSmartMatchPositions() {
    console.log('\n🔍 CURRENT Smart Match Positions (Absolute):');
    const smartMatches = document.querySelectorAll('.smart-match-absolute');
    
    smartMatches.forEach((match, index) => {
        const position = match.getAttribute('data-position');
        const style = match.getAttribute('style');
        
        console.log(`${index + 1}. Position: ${position}`);
        console.log(`   Style: ${style}`);
    });
    
    return smartMatches.length;
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