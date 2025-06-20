// Smart Prediction für Swiss Cup Brackets
// Erstellt Prognose-Runden für fehlende Runden bis 1/8 Final

let predictionData = {};

/**
 * Erweitert das Smart Bracket um Prognose-Runden
 */
function addPredictionRounds() {
    if (!currentRounds || currentRounds.length === 0) {
        console.log('❌ No current rounds available for prediction');
        return;
    }
    
    console.log('🔮 Starting prediction generation...');
    
    // Bestimme welche Runden für Prognose benötigt werden
    const missingRounds = findMissingRounds();
    if (missingRounds.length === 0) {
        console.log('ℹ️ No missing rounds to predict');
        return;
    }
    
    console.log(`🎯 Missing rounds for prediction: ${missingRounds.map(r => r.name).join(', ')}`);
    
    // Finde die Basis-Runde (letzte Runde mit Spielen)
    const baseRound = findBaseRoundForPrediction();
    if (!baseRound) {
        console.log('❌ No base round found for prediction');
        return;
    }
    
    console.log(`📊 Base round: ${baseRound.name} (${baseRound.playedGames}/${baseRound.games.length} games played)`);
    
    // Generiere Prognose-Runden
    const predictionRounds = generatePredictionRounds(missingRounds, baseRound);
    
    if (predictionRounds.length === 0) {
        console.log('ℹ️ No prediction rounds generated');
        return;
    }
    
    // Füge Prognose-Runden zum aktuellen Bracket hinzu
    currentRounds.push(...predictionRounds);
    
    console.log(`✅ Added ${predictionRounds.length} prediction rounds (total rounds now: ${currentRounds.length})`);
    
    // Speichere Prognose-Daten für Debug
    predictionData = {
        baseRound: baseRound.name,
        missingRounds: missingRounds.map(r => r.name),
        generatedRounds: predictionRounds.length,
        rounds: predictionRounds.map(r => ({
            name: r.name,
            games: r.games.length,
            isPrediction: r.isPrediction,
            predictionDistance: r.predictionDistance
        }))
    };
    
    // Re-render das Bracket
    renderSmartBracket();
}

/**
 * Findet fehlende Runden die für Prognose erstellt werden sollen
 */
function findMissingRounds() {
    // Alle möglichen Runden bis 1/8 (ohne 1/4 da dort gelost wird)
    const allPossibleRounds = [
        { name: '1/128', maxGames: 64, priority: 1 },
        { name: '1/64', maxGames: 32, priority: 2 },
        { name: '1/32', maxGames: 32, priority: 3 },
        { name: '1/16', maxGames: 16, priority: 4 },
        { name: '1/8', maxGames: 8, priority: 5 }
    ];
    
    // Existierende Runden
    const existingRoundNames = currentRounds.map(r => r.name.toLowerCase().trim());
    
    // Finde fehlende Runden
    const missingRounds = allPossibleRounds.filter(round => 
        !existingRoundNames.includes(round.name.toLowerCase())
    );
    
    console.log(`🔍 Existing rounds: ${existingRoundNames.join(', ')}`);
    console.log(`❓ Missing rounds: ${missingRounds.map(r => r.name).join(', ')}`);
    
    return missingRounds;
}

/**
 * Findet die Basis-Runde für Prognosen (letzte Runde mit gespielten Spielen)
 */
function findBaseRoundForPrediction() {
    // Sortiere Runden nach Priorität (späteste zuerst)
    const sortedRounds = [...currentRounds].sort((a, b) => {
        return getUnifiedRoundPriority(b.name) - getUnifiedRoundPriority(a.name);
    });
    
    // Finde letzte Runde mit gespielten Spielen
    for (const round of sortedRounds) {
        const playedGames = round.games.filter(game => 
            game.result && game.result.trim() && game.result !== 'TBD'
        ).length;
        
        if (playedGames > 0) {
            return {
                ...round,
                playedGames,
                hasPartialResults: playedGames < round.games.length
            };
        }
    }
    
    // Fallback: Erste Runde falls keine gespielten Spiele
    return sortedRounds.length > 0 ? {
        ...sortedRounds[sortedRounds.length - 1],
        playedGames: 0,
        hasPartialResults: false
    } : null;
}

/**
 * Generiert Prognose-Runden basierend auf fehlenden Runden
 */
function generatePredictionRounds(missingRounds, baseRound) {
    const predictionRounds = [];
    
    // Sortiere fehlende Runden chronologisch (früh zu spät)
    const sortedMissingRounds = missingRounds.sort((a, b) => a.priority - b.priority);
    
    sortedMissingRounds.forEach((roundInfo, index) => {
        console.log(`🔮 Generating prediction for ${roundInfo.name} (max ${roundInfo.maxGames} games)`);
        
        // Berechne Distanz von der letzten gespielten Runde
        const baseRoundPriority = getRoundPriorityByName(baseRound.name);
        const predictionDistance = roundInfo.priority - baseRoundPriority;
        
        const predictionGames = generatePredictionGames(
            roundInfo.name, 
            roundInfo.maxGames, 
            predictionDistance,
            baseRound
        );
        
        if (predictionGames.length === 0) {
            console.log(`   No games to predict for ${roundInfo.name}`);
            return;
        }
        
        // Berechne Layout für Prognose-Runde
        const layout = calculatePredictionLayout(predictionGames, roundInfo.name);
        
        predictionRounds.push({
            name: roundInfo.name,
            games: predictionGames,
            originalGameCount: predictionGames.length,
            layout: layout,
            isPrediction: true,
            predictionDistance: predictionDistance,
            index: currentRounds.length + predictionRounds.length
        });
        
        console.log(`   ✅ Generated ${predictionGames.length} prediction games for ${roundInfo.name} (distance: ${predictionDistance})`);
    });
    
    return predictionRounds;
}

/**
 * Holt Runden-Priorität basierend auf Namen
 */
function getRoundPriorityByName(roundName) {
    const priorityMap = {
        '1/128': 1,
        '1/64': 2,
        '1/32': 3,
        '1/16': 4,
        '1/8': 5,
        '1/4': 6,
        '1/2': 7,
        'finale': 8
    };
    
    return priorityMap[roundName.toLowerCase().trim()] || 1;
}

/**
 * Generiert Prognose-Spiele für eine Runde
 */
function generatePredictionGames(roundName, maxGames, distanceFromCurrent, baseRound) {
    const games = [];
    
    for (let i = 0; i < maxGames; i++) {
        // Bestimme Teams basierend auf Distanz
        let team1, team2;
        
        if (distanceFromCurrent === 1) {
            // 1 Runde voraus: "Team A / Team B" oder bekannte Teams durch Freilos
            const teamPair = predictNextRoundTeams(i, baseRound);
            team1 = teamPair.team1;
            team2 = teamPair.team2;
            
            // Prüfe auf Freilos - falls ja, überspringe dieses Spiel
            if (isFreilos(team1) || isFreilos(team2)) {
                console.log(`   Skipping prediction game ${i + 1} due to Freilos`);
                continue;
            }
            
        } else {
            // 2+ Runden voraus: TBD (außer bekannte Teams durch Freilos-Kette)
            const teamPair = predictDistantRoundTeams(i, distanceFromCurrent, baseRound);
            team1 = teamPair.team1;
            team2 = teamPair.team2;
            
            // Prüfe auf Freilos
            if (isFreilos(team1) || isFreilos(team2)) {
                console.log(`   Skipping distant prediction game ${i + 1} due to Freilos`);
                continue;
            }
        }
        
        // Erstelle Prognose-Spiel
        const predictionGame = {
            gameId: `PRED_${roundName}_${i + 1}`,
            numericGameId: null, // Keine Game-ID für Prognosen
            team1: team1,
            team2: team2,
            result: 'TBD',
            roundName: roundName,
            bracketSortOrder: i + 1,
            isPrediction: true,
            predictionDistance: distanceFromCurrent
        };
        
        games.push(predictionGame);
    }
    
    return games;
}

/**
 * Prognostiziert Teams für die nächste Runde (Distanz 1)
 */
function predictNextRoundTeams(gameIndex, baseRound) {
    // Logik: Schaue auf entsprechende Spiele der Basis-Runde
    const baseGameIndex1 = gameIndex * 2;      // Oberes Spiel
    const baseGameIndex2 = gameIndex * 2 + 1;  // Unteres Spiel
    
    let team1 = 'TBD';  // Aus oberem Spiel
    let team2 = 'TBD';  // Aus unterem Spiel
    
    // Team 1: Gewinner/Teams aus oberem Spiel (baseGameIndex1)
    if (baseGameIndex1 < baseRound.games.length) {
        const baseGame1 = baseRound.games[baseGameIndex1];
        team1 = getWinnerOrPredictedTeam(baseGame1);
    }
    
    // Team 2: Gewinner/Teams aus unterem Spiel (baseGameIndex2)
    if (baseGameIndex2 < baseRound.games.length) {
        const baseGame2 = baseRound.games[baseGameIndex2];
        team2 = getWinnerOrPredictedTeam(baseGame2);
    }
    
    // Bereinige Freilos-Teams
    if (isFreilos(team1)) team1 = 'TBD';
    if (isFreilos(team2)) team2 = 'TBD';
    
    return { team1: team1, team2: team2 };
}

/**
 * Prognostiziert Teams für entfernte Runden (Distanz 2+)
 */
function predictDistantRoundTeams(gameIndex, distance, baseRound) {
    // Für entfernte Runden nur TBD, außer durch Freilos-Ketten bekannt
    // TODO: Erweiterte Logik für Freilos-Verfolgung über mehrere Runden
    return { team1: 'TBD', team2: 'TBD' };
}

/**
 * Ermittelt Gewinner oder prognostiziertes Team aus einem Spiel
 */
function getWinnerOrPredictedTeam(game) {
    // Falls Spiel gespielt: Gewinner ermitteln
    if (game.result && game.result.trim() && game.result !== 'TBD') {
        const winner = getGameWinner(game);
        if (winner) return winner;
    }
    
    // Falls nicht gespielt: Prüfe auf Freilos
    if (isFreilos(game.team1)) return game.team2;
    if (isFreilos(game.team2)) return game.team1;
    
    // Falls beide Teams bekannt aber noch nicht gespielt: kombiniere mit "/"
    if (game.team1 && game.team2 && game.team1 !== 'TBD' && game.team2 !== 'TBD') {
        return `${game.team1} / ${game.team2}`;
    }
    
    return 'TBD';
}

/**
 * Ermittelt den Gewinner eines gespielten Spiels
 */
function getGameWinner(game) {
    if (!game.result || !game.result.trim() || game.result === 'TBD') {
        return null;
    }
    
    const scores = parseScore(game.result);
    if (!scores) return null;
    
    const team1Score = parseInt(scores.team1) || 0;
    const team2Score = parseInt(scores.team2) || 0;
    
    if (team1Score > team2Score) return game.team1;
    if (team2Score > team1Score) return game.team2;
    
    return null; // Unentschieden
}

/**
 * Berechnet Layout für Prognose-Runden
 */
function calculatePredictionLayout(games, roundName) {
    // Verwende die gleiche Layout-Logik wie für echte Spiele
    // Aber basierend auf der aktuellen Bracket-Höhe
    const totalHeight = debugData ? debugData.actualBracketHeight : calculateCompactBracketHeight(games.length);
    
    if (games.length === 1) {
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
    
    // Dynamischer Abstand für mehrere Spiele
    const spacingBetweenGames = (totalHeight - (games.length * MATCH_HEIGHT)) / games.length;
    const topMargin = spacingBetweenGames / 2;
    
    console.log(`   📏 Prediction layout "${roundName}": ${games.length} games, spacing: ${spacingBetweenGames.toFixed(1)}px`);
    
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
 * Debug-Funktion für Prognose-Daten
 */
function showPredictionDebug() {
    if (!predictionData || Object.keys(predictionData).length === 0) {
        console.log('❌ No prediction data available');
        return;
    }
    
    console.log('\n🔮 PREDICTION DEBUG:');
    console.log(`Base Round: ${predictionData.baseRound}`);
    console.log(`Missing Rounds: ${predictionData.missingRounds.join(', ')}`);
    console.log(`Generated Rounds: ${predictionData.generatedRounds}`);
    console.log('\nGenerated Prediction Rounds:');
    
    predictionData.rounds.forEach((round, index) => {
        console.log(`${index + 1}. ${round.name}: ${round.games} games (distance: ${round.predictionDistance})`);
    });
}

/**
 * Entfernt alle Prognose-Runden
 */
function removePredictionRounds() {
    if (!currentRounds) return;
    
    const originalLength = currentRounds.length;
    currentRounds = currentRounds.filter(round => !round.isPrediction);
    const removedCount = originalLength - currentRounds.length;
    
    if (removedCount > 0) {
        console.log(`🗑️ Removed ${removedCount} prediction rounds`);
        predictionData = {};
        renderSmartBracket();
    }
}

// Globale Funktionen exportieren
window.addPredictionRounds = addPredictionRounds;
window.removePredictionRounds = removePredictionRounds;
window.showPredictionDebug = showPredictionDebug;