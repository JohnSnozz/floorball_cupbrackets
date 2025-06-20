// modules/prognose-games.js - Prognose Spiele Generator

/**
 * Generiert Prognose-Spiele basierend auf der aktuellen Bracket-Situation
 * Nur bis und mit 1/8 Final - danach gibt es eine Losung
 */

// Round-Hierarchie für Cup-Turniere (von spät zu früh)
const ROUND_HIERARCHY = [
    '1/8 Final',
    '1/16 Final',
    '1/32 Final',
    '1/64 Final',
    '1/128 Final'
];

// Mapping für nächste Runde (nur bis 1/8 Final)
const NEXT_ROUND_MAP = {
    '1/128': '1/64',
    '1/64': '1/32', 
    '1/32': '1/16',
    '1/16': '1/8',
    // Auch mit "Final" Suffix unterstützen
    '1/128 Final': '1/64 Final',
    '1/64 Final': '1/32 Final', 
    '1/32 Final': '1/16 Final',
    '1/16 Final': '1/8 Final'
};

/**
 * Hauptfunktion: Generiert Prognose-Spiele für eine Saison/Cup
 */
async function generatePrognoseGames(db, cupType, season) {
    try {
        console.log(`🔮 Generiere Prognose-Spiele für ${cupType} ${season}...`);
        
        // Debug: Prüfe ob überhaupt Spiele in der DB sind
        const totalGames = await new Promise((resolve) => {
            db.get('SELECT COUNT(*) as count FROM games WHERE cupType = ? AND season = ? AND source != ?', 
                  [cupType, season, 'prognose'], (err, row) => {
                resolve(row ? row.count : 0);
            });
        });
        
        console.log(`   🔍 Debug: ${totalGames} Spiele in DB für ${cupType} ${season}`);
        
        if (totalGames === 0) {
            console.log(`   ❌ Keine Spiele gefunden für ${cupType} ${season} - kann keine Prognose erstellen`);
            return { generated: 0, updated: 0, error: 'Keine Spiele in DB gefunden' };
        }
        
        // 1. Finde nächste nicht-existierende Runde
        const roundInfo = await findNextNonExistentRound(db, cupType, season);
        if (!roundInfo.lastExistingRound || !roundInfo.nextRound) {
            console.log(`   ❌ Kann keine Prognose-Runde bestimmen für ${cupType} ${season}`);
            return { generated: 0, updated: 0, error: 'Keine Prognose-Runde bestimmbar' };
        }
        
        const lastExistingRound = roundInfo.lastExistingRound;
        const nextRound = roundInfo.nextRound;
        const nextNextRound = NEXT_ROUND_MAP[nextRound];
        
        console.log(`   🔍 Debug: nextRound = ${nextRound}, nextNextRound = ${nextNextRound}`);
        
        // 2. Prüfe ob Prognose möglich ist (bis 1/8 Final)
        if (!nextRound || nextRound === '1/4' || nextRound === 'Halbfinal' || nextRound === 'Final') {
            console.log(`   ✅ Prognose nicht mehr möglich (nächste Runde: ${nextRound || 'KEINE'}) - nach 1/8 Final gibt es eine Losung`);
            return { generated: 0, updated: 0, error: 'Prognose nach 1/8 Final nicht möglich' };
        }
        
        console.log(`   🎯 Generiere Runde: ${nextRound}`);
        if (nextNextRound) {
            console.log(`   🎯 Generiere Runde: ${nextNextRound} (TBD)`);
        }
        
        // 3. Hole Tournament-Info
        const tournamentInfo = await getTournamentInfo(db, cupType, season);
        if (!tournamentInfo) {
            console.log(`   ❌ Tournament-Info nicht gefunden für ${cupType} ${season}`);
            return { generated: 0, updated: 0, error: 'Tournament-Info nicht gefunden' };
        }
        
        console.log(`   🔍 Debug: Tournament-Info gefunden: ${tournamentInfo.tournamentName}`);
        
        // 4. Lösche ALLE existierenden Prognose-Spiele für diesen Cup/Saison
        console.log(`   🧹 Lösche alle existierenden Prognose-Spiele...`);
        const deletedCount = await deleteAllPrognoseGames(db, cupType, season);
        
        let totalGenerated = 0;
        
        // 5. Generiere nächste Runde (mit echten Teams)
        console.log(`   🔧 Starte Generierung von ${nextRound}...`);
        const nextRoundGames = await generateNextRoundGames(db, cupType, season, lastExistingRound, nextRound, tournamentInfo);
        totalGenerated += nextRoundGames;
        
        // 6. Generiere übernächste Runde (mit TBD, falls möglich)
        if (nextNextRound) {
            console.log(`   🔧 Starte Generierung von ${nextNextRound}...`);
            const nextNextRoundGames = await generateTBDRoundGames(db, cupType, season, nextRound, nextNextRound, tournamentInfo);
            totalGenerated += nextNextRoundGames;
        }
        
        console.log(`   ✅ ${totalGenerated} Prognose-Spiele generiert`);
        
        return { 
            generated: totalGenerated, 
            nextRound: nextRound,
            nextNextRound: nextNextRound
        };
        
    } catch (error) {
        console.error(`❌ Fehler bei Prognose-Generierung für ${cupType} ${season}: ${error.message}`);
        console.error(error.stack);
        return { generated: 0, updated: 0, error: error.message };
    }
}

/**
 * Findet die nächste Runde die NICHT existiert (für Prognose)
 */
async function findNextNonExistentRound(db, cupType, season) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT DISTINCT roundName, COUNT(*) as gameCount,
                   COUNT(CASE WHEN result IS NOT NULL AND result != '' AND result != 'TBD' THEN 1 END) as playedCount,
                   COUNT(CASE WHEN source = 'prognose' THEN 1 END) as prognoseCount
            FROM games 
            WHERE cupType = ? AND season = ?
            GROUP BY roundName
            ORDER BY 
                CASE roundName 
                    WHEN '1/128' THEN 1
                    WHEN '1/64' THEN 2 
                    WHEN '1/32' THEN 3
                    WHEN '1/16' THEN 4
                    WHEN '1/8' THEN 5
                    WHEN '1/4' THEN 6
                    WHEN 'Halbfinal' THEN 7
                    WHEN 'Final' THEN 8
                    ELSE 9
                END ASC
        `;
        
        db.all(sql, [cupType, season], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                console.log(`   🔍 Debug: Alle Runden für ${cupType} ${season}:`);
                
                if (!rows || rows.length === 0) {
                    console.log(`   ⚠️ Keine Runden gefunden`);
                    resolve({ lastExistingRound: null, nextRound: null });
                    return;
                }
                
                let lastExistingRound = null;
                let nextRound = null;
                
                // Zeige alle Runden mit Status
                for (const row of rows) {
                    const playedPercent = Math.round((row.playedCount / row.gameCount) * 100);
                    const hasPrognose = row.prognoseCount > 0;
                    const status = hasPrognose ? '🔮 PROGNOSE' : (playedPercent > 0 ? '✅ ECHT' : '❓ LEER');
                    
                    console.log(`     📊 ${row.roundName}: ${row.playedCount}/${row.gameCount} gespielt (${playedPercent}%) - ${status}`);
                    
                    // Nur echte Spiele (nicht Prognose) zählen als "existierende Runde"
                    if (row.gameCount > row.prognoseCount) {
                        lastExistingRound = row.roundName;
                    }
                }
                
                // Bestimme nächste Runde nach der letzten existierenden
                if (lastExistingRound) {
                    nextRound = NEXT_ROUND_MAP[lastExistingRound];
                    console.log(`   📍 Letzte existierende Runde: ${lastExistingRound}`);
                    console.log(`   🎯 Nächste zu generierende Runde: ${nextRound || 'KEINE (Turnier Ende)'}`);
                } else {
                    console.log(`   ⚠️ Keine existierende Runde gefunden`);
                }
                
                resolve({ 
                    lastExistingRound: lastExistingRound,
                    nextRound: nextRound 
                });
            }
        });
    });
}

/**
 * Holt Tournament-Informationen für Prognose-Spiele
 */
async function getTournamentInfo(db, cupType, season) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT DISTINCT tournamentId, tournamentName, gender, fieldType
            FROM games 
            WHERE cupType = ? AND season = ?
            LIMIT 1
        `;
        
        db.get(sql, [cupType, season], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

/**
 * Löscht existierende Prognose-Spiele für bestimmte Runden
 */
async function deleteExistingPrognoseGames(db, cupType, season, rounds) {
    return new Promise((resolve, reject) => {
        const placeholders = rounds.map(() => '?').join(',');
        const sql = `
            DELETE FROM games 
            WHERE cupType = ? AND season = ? 
            AND source = 'prognose'
            AND roundName IN (${placeholders})
        `;
        
        db.run(sql, [cupType, season, ...rounds], function(err) {
            if (err) {
                reject(err);
            } else {
                console.log(`   🗑️ ${this.changes} existierende Prognose-Spiele gelöscht`);
                resolve(this.changes);
            }
        });
    });
}

/**
 * Generiert die nächste Runde mit echten Team-Namen
 */
async function generateNextRoundGames(db, cupType, season, lastRound, nextRound, tournamentInfo) {
    try {
        console.log(`   🎯 Generiere ${nextRound} mit echten Teams...`);
        
        // Hole alle Spiele der letzten Runde, sortiert nach bracketSortOrder
        const lastRoundGames = await getGamesForRound(db, cupType, season, lastRound);
        
        if (lastRoundGames.length === 0) {
            throw new Error(`Keine Spiele in Runde ${lastRound} gefunden`);
        }
        
        console.log(`   📊 ${lastRoundGames.length} Spiele in ${lastRound} gefunden`);
        
        // Gruppiere Spiele paarweise für nächste Runde
        const nextRoundPairs = [];
        
        for (let i = 0; i < lastRoundGames.length; i += 2) {
            const game1 = lastRoundGames[i];
            const game2 = lastRoundGames[i + 1];
            
            // 🔧 KORREKTE bracketSortOrder: Erste Spiel-Position / 2 GERUNDET NACH OBEN
            const newSortOrder = Math.ceil((game1.bracketSortOrder || 1) / 2);
            
            if (game2) {
                // Zwei Spiele -> bestimme beide Teams
                const team1 = determineWinnerOrAdvancer(game1);
                const team2 = determineWinnerOrAdvancer(game2);
                
                // 🔧 FREILOS-LOGIC: Falls ein Team Freilos hat, kombiniere mit dem anderen Spiel
                if (team1 === 'Freilos' && team2 !== 'Freilos') {
                    // game1 hat Freilos, game2 ist echtes Spiel -> kombiniere
                    const realTeam1 = game1.team1 === 'Freilos' ? game1.team2 : game1.team1;
                    nextRoundPairs.push({
                        team1: realTeam1,
                        team2: team2,
                        sortOrder: newSortOrder
                    });
                } else if (team2 === 'Freilos' && team1 !== 'Freilos') {
                    // game2 hat Freilos, game1 ist echtes Spiel -> kombiniere
                    const realTeam2 = game2.team1 === 'Freilos' ? game2.team2 : game2.team1;
                    nextRoundPairs.push({
                        team1: team1,
                        team2: realTeam2,
                        sortOrder: newSortOrder
                    });
                } else if (team1 !== 'Freilos' && team2 !== 'Freilos') {
                    // Beide sind echte Spiele
                    nextRoundPairs.push({
                        team1: team1,
                        team2: team2,
                        sortOrder: newSortOrder
                    });
                }
                // Falls beide Freilos sind, überspringe komplett
                
            } else {
                // Nur ein Spiel -> automatischer Aufsteiger mit Freilos
                const team1 = determineWinnerOrAdvancer(game1);
                
                if (team1 !== 'Freilos') {
                    nextRoundPairs.push({
                        team1: team1,
                        team2: 'Freilos',
                        sortOrder: newSortOrder
                    });
                }
            }
        }
        
        // Sortiere Paare nach sortOrder
        nextRoundPairs.sort((a, b) => a.sortOrder - b.sortOrder);
        
        console.log(`   🔍 Debug: ${nextRoundPairs.length} Paare für ${nextRound} erstellt`);
        
        // Generiere Spiele für nächste Runde
        let generatedCount = 0;
        
        for (let i = 0; i < nextRoundPairs.length; i++) {
            const pair = nextRoundPairs[i];
            
            // 🔧 FREILOS-HANDLING: Falls beide Teams Freilos sind, überspringe das Spiel
            if (pair.team1 === 'Freilos' && pair.team2 === 'Freilos') {
                console.log(`   ⏭️ Überspringe Freilos vs Freilos Paarung`);
                continue;
            }
            
            const gameData = {
                gameId: await generateUniquePrognoseId(db),
                team1: pair.team1,
                team2: pair.team2,
                roundName: nextRound,
                roundId: await getNextRoundId(db, cupType, season),
                tournamentId: tournamentInfo.tournamentId,
                tournamentName: tournamentInfo.tournamentName,
                season: season,
                cupType: cupType,
                gender: tournamentInfo.gender,
                fieldType: tournamentInfo.fieldType,
                gameDate: '',
                gameTime: '',
                venue: '',
                status: 'prognose',
                result: 'TBD',
                source: 'prognose',
                apiEndpoint: '',
                link: '',
                homeTeamScore: null,
                awayTeamScore: null,
                gameLocation: null,
                referees: null,
                spectators: null,
                notes: 'Automatisch generierte Prognose',
                numericGameId: null,
                bracketSortOrder: pair.sortOrder
            };
            
            try {
                await savePrognoseGame(db, gameData);
                generatedCount++;
                console.log(`   ✅ ${pair.team1} vs ${pair.team2} (${nextRound}) - ID: ${gameData.gameId}`);
            } catch (saveError) {
                console.error(`   ❌ Fehler beim Speichern: ${saveError.message}`);
            }
        }
        
        console.log(`   📊 ${generatedCount} Spiele für ${nextRound} generiert`);
        return generatedCount;
        
    } catch (error) {
        console.error(`❌ Fehler bei ${nextRound} Generierung: ${error.message}`);
        return 0;
    }
}

/**
 * Generiert übernächste Runde mit TBD Teams
 */
async function generateTBDRoundGames(db, cupType, season, currentRound, nextRound, tournamentInfo) {
    try {
        console.log(`   🎯 Generiere ${nextRound} mit TBD Teams...`);
        
        // Hole alle Prognose-Spiele der aktuellen Runde
        const currentRoundGames = await getPrognoseGamesForRound(db, cupType, season, currentRound);
        
        if (currentRoundGames.length === 0) {
            console.log(`   ⚠️ Keine Prognose-Spiele in ${currentRound} gefunden`);
            return 0;
        }
        
        console.log(`   📊 ${currentRoundGames.length} Prognose-Spiele in ${currentRound} gefunden`);
        
        // Gruppiere Spiele paarweise für nächste Runde
        const nextRoundPairs = [];
        
        for (let i = 0; i < currentRoundGames.length; i += 2) {
            const game1 = currentRoundGames[i];
            const game2 = currentRoundGames[i + 1];
            
            if (game2) {
                // Zwei Spiele -> TBD Paar (außer bei Freilos-Automatik)
                const team1 = determineTBDOrAdvancer(game1);
                const team2 = determineTBDOrAdvancer(game2);
                
                // Skip wenn beide Freilos
                if (team1 === 'Freilos' && team2 === 'Freilos') {
                    continue;
                }
                
                nextRoundPairs.push({
                    team1: team1,
                    team2: team2,
                    sortOrder: Math.min(game1.bracketSortOrder || 999999, game2.bracketSortOrder || 999999)
                });
            } else {
                // Nur ein Spiel -> automatischer Aufsteiger
                const team1 = determineTBDOrAdvancer(game1);
                
                if (team1 !== 'Freilos') {
                    nextRoundPairs.push({
                        team1: team1,
                        team2: 'Freilos',
                        sortOrder: game1.bracketSortOrder || 999999
                    });
                }
            }
        }
        
        // Sortiere Paare nach sortOrder
        nextRoundPairs.sort((a, b) => a.sortOrder - b.sortOrder);
        
        console.log(`   🔍 Debug: ${nextRoundPairs.length} TBD-Paare für ${nextRound} erstellt`);
        
        // Generiere TBD-Spiele für übernächste Runde
        let generatedCount = 0;
        
        for (let i = 0; i < nextRoundPairs.length; i++) {
            const pair = nextRoundPairs[i];
            
            const tbdGameData = {
                gameId: await generateUniquePrognoseId(db),
                team1: pair.team1,
                team2: pair.team2,
                roundName: nextRound,
                roundId: await getNextRoundId(db, cupType, season),
                tournamentId: tournamentInfo.tournamentId,
                tournamentName: tournamentInfo.tournamentName,
                season: season,
                cupType: cupType,
                gender: tournamentInfo.gender,
                fieldType: tournamentInfo.fieldType,
                gameDate: '',
                gameTime: '',
                venue: '',
                status: 'prognose',
                result: 'TBD',
                source: 'prognose',
                apiEndpoint: '',
                link: '',
                homeTeamScore: null,
                awayTeamScore: null,
                gameLocation: null,
                referees: null,
                spectators: null,
                notes: 'Automatisch generierte TBD Prognose',
                numericGameId: null,
                bracketSortOrder: pair.sortOrder
            };
            
            try {
                await savePrognoseGame(db, tbdGameData);
                generatedCount++;
                console.log(`   ✅ ${pair.team1} vs ${pair.team2} (${nextRound} TBD) - ID: ${tbdGameData.gameId}`);
            } catch (saveError) {
                console.error(`   ❌ Fehler beim TBD-Speichern: ${saveError.message}`);
            }
        }
        
        console.log(`   📊 ${generatedCount} TBD-Spiele für ${nextRound} generiert`);
        return generatedCount;
        
    } catch (error) {
        console.error(`❌ Fehler bei ${nextRound} TBD-Generierung: ${error.message}`);
        return 0;
    }
}

/**
 * Bestimmt TBD oder fixen Aufsteiger für übernächste Runde
 */
function determineTBDOrAdvancer(game) {
    // Wenn ein Team bereits fix Freilos hat, kann es fix gesetzt werden
    if (game.team1 === 'Freilos') {
        return game.team2;
    }
    if (game.team2 === 'Freilos') {
        return game.team1;
    }
    
    // Für alle anderen Fälle: TBD
    return 'TBD';
}

/**
 * Holt alle Prognose-Spiele einer bestimmten Runde
 */
async function getPrognoseGamesForRound(db, cupType, season, roundName) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT * FROM games 
            WHERE cupType = ? AND season = ? AND roundName = ?
            AND source = 'prognose'
            ORDER BY bracketSortOrder ASC, gameId ASC
        `;
        
        db.all(sql, [cupType, season, roundName], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}
function determineWinnerOrAdvancer(game) {
    // Wenn ein Team Freilos ist, steigt das andere automatisch auf
    if (game.team1 === 'Freilos') {
        return game.team2;
    }
    if (game.team2 === 'Freilos') {
        return game.team1;
    }
    
    // Wenn das Spiel gespielt wurde, bestimme Gewinner
    if (game.result && game.result.trim() !== '' && game.result !== 'TBD') {
        const winner = determineWinnerFromResult(game.result, game.team1, game.team2);
        if (winner) {
            return winner;
        }
    }
    
    // Fallback: Team1 / Team2 Format für unentschiedene Spiele
    return `${game.team1} / ${game.team2}`;
}

/**
 * Bestimmt Gewinner aus Resultat-String
 */
function determineWinnerFromResult(result, team1, team2) {
    // Erwarte Format wie "3:1", "2:4", etc.
    const parts = result.split(':');
    if (parts.length === 2) {
        const score1 = parseInt(parts[0]);
        const score2 = parseInt(parts[1]);
        
        if (!isNaN(score1) && !isNaN(score2)) {
            if (score1 > score2) {
                return team1;
            } else if (score2 > score1) {
                return team2;
            }
        }
    }
    
    return null; // Unentschieden oder unklares Resultat
}

/**
 * Holt alle Spiele einer bestimmten Runde
 */
async function getGamesForRound(db, cupType, season, roundName) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT * FROM games 
            WHERE cupType = ? AND season = ? AND roundName = ?
            AND source != 'prognose'
            ORDER BY bracketSortOrder ASC, gameId ASC
        `;
        
        db.all(sql, [cupType, season, roundName], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}

/**
 * Generiert eine eindeutige Prognose-ID
 */
async function generateUniquePrognoseId(db) {
    return new Promise((resolve, reject) => {
        // Finde die höchste bestehende Prognose-ID
        const sql = `
            SELECT gameId FROM games 
            WHERE gameId LIKE 'prognose_%'
            ORDER BY CAST(SUBSTR(gameId, 10) AS INTEGER) DESC
            LIMIT 1
        `;
        
        db.get(sql, [], (err, row) => {
            if (err) {
                reject(err);
            } else {
                let nextNumber = 1;
                
                if (row && row.gameId) {
                    const currentNumber = parseInt(row.gameId.replace('prognose_', ''));
                    if (!isNaN(currentNumber)) {
                        nextNumber = currentNumber + 1;
                    }
                }
                
                // Formatiere mit führenden Nullen (7 Stellen)
                const paddedNumber = nextNumber.toString().padStart(7, '0');
                resolve(`prognose_${paddedNumber}`);
            }
        });
    });
}

/**
 * Bestimmt die nächste Round-ID
 */
async function getNextRoundId(db, cupType, season) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT MAX(CAST(roundId AS INTEGER)) as maxRoundId
            FROM games 
            WHERE cupType = ? AND season = ?
        `;
        
        db.get(sql, [cupType, season], (err, row) => {
            if (err) {
                reject(err);
            } else {
                const nextRoundId = (row && row.maxRoundId) ? row.maxRoundId + 1 : 1000;
                resolve(nextRoundId.toString());
            }
        });
    });
}

/**
 * Speichert ein Prognose-Spiel in die Datenbank
 */
async function savePrognoseGame(db, gameData) {
    return new Promise((resolve, reject) => {
        const sql = `
            INSERT INTO games (
                gameId, team1, team2, roundName, roundId, tournamentId, tournamentName,
                season, cupType, gender, fieldType, gameDate, gameTime, venue, status,
                result, source, apiEndpoint, link, homeTeamScore, awayTeamScore,
                gameLocation, referees, spectators, notes, numericGameId, bracketSortOrder
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const values = [
            gameData.gameId, gameData.team1, gameData.team2, gameData.roundName,
            gameData.roundId, gameData.tournamentId, gameData.tournamentName,
            gameData.season, gameData.cupType, gameData.gender, gameData.fieldType,
            gameData.gameDate, gameData.gameTime, gameData.venue, gameData.status,
            gameData.result, gameData.source, gameData.apiEndpoint, gameData.link,
            gameData.homeTeamScore, gameData.awayTeamScore, gameData.gameLocation,
            gameData.referees, gameData.spectators, gameData.notes,
            gameData.numericGameId, gameData.bracketSortOrder
        ];
        
        db.run(sql, values, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ changes: this.changes, lastID: this.lastID });
            }
        });
    });
}

/**
 * Löscht alle Prognose-Spiele für einen Cup/Saison
 */
async function deleteAllPrognoseGames(db, cupType, season) {
    return new Promise((resolve, reject) => {
        const sql = `
            DELETE FROM games 
            WHERE cupType = ? AND season = ? AND source = 'prognose'
        `;
        
        db.run(sql, [cupType, season], function(err) {
            if (err) {
                reject(err);
            } else {
                console.log(`   🗑️ ${this.changes} Prognose-Spiele für ${cupType} ${season} gelöscht`);
                resolve(this.changes);
            }
        });
    });
}

/**
 * Generiert Prognose-Spiele für alle aktuellen Cups
 */
async function generatePrognoseForAllCups(db, season) {
    const CUPS = ['herren_grossfeld', 'damen_grossfeld', 'herren_kleinfeld', 'damen_kleinfeld'];
    
    console.log(`🔮 Generiere Prognose-Spiele für alle Cups (Saison ${season})...`);
    
    let totalGenerated = 0;
    const results = [];
    
    for (const cupType of CUPS) {
        try {
            console.log(`\n🏆 ${getCupDisplayName(cupType)}:`);
            const result = await generatePrognoseGames(db, cupType, season);
            
            totalGenerated += result.generated;
            results.push({
                cupType: cupType,
                ...result
            });
            
        } catch (error) {
            console.error(`❌ Fehler bei ${cupType}: ${error.message}`);
            results.push({
                cupType: cupType,
                generated: 0,
                error: error.message
            });
        }
    }
    
    console.log(`\n📊 Prognose-Generierung abgeschlossen:`);
    console.log(`   🔮 Total generiert: ${totalGenerated} Spiele`);
    
    return {
        totalGenerated: totalGenerated,
        results: results
    };
}

/**
 * Hilfsfunktion: Lesbare Cup-Namen
 */
function getCupDisplayName(cupType) {
    const names = {
        'herren_grossfeld': '🏒 Herren Grossfeld',
        'damen_grossfeld': '🏒 Damen Grossfeld',
        'herren_kleinfeld': '🏑 Herren Kleinfeld',
        'damen_kleinfeld': '🏑 Damen Kleinfeld'
    };
    return names[cupType] || cupType;
}

/**
 * API Route Registration
 */
function register(app, db) {
    console.log('🔧 Registriere Prognose-Routen...');
    
    // GET /generate-prognose - Generiert Prognose für einen spezifischen Cup
    app.get('/generate-prognose', async (req, res) => {
        const cupType = req.query.cup || 'herren_grossfeld';
        const season = req.query.season || '2025/26';
        
        try {
            const result = await generatePrognoseGames(db, cupType, season);
            
            res.json({
                success: true,
                cupType: cupType,
                season: season,
                ...result
            });
            
        } catch (error) {
            console.error('❌ Prognose API Error:', error.message);
            res.status(500).json({
                success: false,
                error: error.message,
                cupType: cupType,
                season: season
            });
        }
    });
    
    console.log('✅ Prognose-Routen registriert');
}

module.exports = {
    generatePrognoseGames,
    generatePrognoseForAllCups,
    deleteAllPrognoseGames,
    register
};