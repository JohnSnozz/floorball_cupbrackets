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

// Mapping für nächste Runde (bis 1/8 Final)
const NEXT_ROUND_MAP = {
    '1/128': '1/64',
    '1/64': '1/32', 
    '1/32': '1/16',
    '1/16': '1/8',
    '1/8': '1/4',
    // Auch mit "Final" Suffix unterstützen
    '1/128 Final': '1/64 Final',
    '1/64 Final': '1/32 Final', 
    '1/32 Final': '1/16 Final',
    '1/16 Final': '1/8 Final',
    '1/8 Final': '1/4 Final'
};

/**
 * Holt TeamShort aus der teamShorts Tabelle
 */
async function getTeamShort(db, teamName) {
    return new Promise((resolve) => {
        const sql = 'SELECT teamShort FROM teamShorts WHERE team = ?';
        
        db.get(sql, [teamName], (err, row) => {
            if (err || !row) {
                // Fallback: ursprünglicher Teamname
                resolve(teamName);
            } else {
                resolve(row.teamShort);
            }
        });
    });
}

/**
 * Erstellt Team-Verknüpfung mit Kurznamen
 */
async function createTeamCombination(db, team1, team2) {
    const team1Short = await getTeamShort(db, team1);
    const team2Short = await getTeamShort(db, team2);
    
    return `${team1Short} / ${team2Short}`;
}

/**
 * Hauptfunktion: Generiert Prognose-Spiele für eine Saison/Cup
 */
async function generatePrognoseGames(db, cupType, season) {
    try {
        console.log(`🔮 Generiere Prognose-Spiele für ${cupType} ${season}...`);
        
        // 1. Prüfe ob überhaupt Spiele in der DB sind
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
        
        // 2. Finde letzte echte Runde (Startpunkt)
        const lastRealRound = await findLastRealRound(db, cupType, season);
        if (!lastRealRound) {
            console.log(`   ❌ Keine echte Runde gefunden für ${cupType} ${season}`);
            return { generated: 0, updated: 0, error: 'Keine echte Runde gefunden' };
        }
        
        // 3. Hole Tournament-Info
        const tournamentInfo = await getTournamentInfo(db, cupType, season);
        if (!tournamentInfo) {
            console.log(`   ❌ Tournament-Info nicht gefunden für ${cupType} ${season}`);
            return { generated: 0, updated: 0, error: 'Tournament-Info nicht gefunden' };
        }
        
        // 4. Lösche ALLE existierenden Prognose-Spiele für diesen Cup/Saison
        console.log(`   🧹 Lösche alle existierenden Prognose-Spiele...`);
        await deleteAllPrognoseGames(db, cupType, season);
        
        // 5. Iterative Prognose-Generierung
        let totalGenerated = 0;
        let currentRound = lastRealRound;
        const generatedRounds = [];
        let iteration = 1;
        
        console.log(`   🔄 Starte iterative Generierung ab Runde: ${currentRound}`);
        
        while (true) {
            console.log(`   \n🔄 Iteration ${iteration}: Aktuelle Runde = ${currentRound}`);
            
            // Bestimme nächste Runde ZUERST
            const nextRound = NEXT_ROUND_MAP[currentRound];
            console.log(`   🔍 Debug: NEXT_ROUND_MAP["${currentRound}"] = "${nextRound}"`);
            
            if (!nextRound) {
                console.log(`   🛑 Keine nächste Runde für ${currentRound} gefunden (NEXT_ROUND_MAP fehlt)`);
                break;
            }
            
            // Prüfe ob die NÄCHSTE Runde eine Stopp-Runde ist
            if (nextRound === '1/4' || nextRound === '1/2' || nextRound === '1/1') {
                console.log(`   🛑 Stoppe vor Generierung von ${nextRound} - ab hier gibt es Losung`);
                break;
            }
            
            console.log(`   🎯 Generiere ${nextRound} basierend auf ${currentRound}...`);
            
            // Generiere nächste Runde
            const generatedCount = await generatePrognoseRound(db, cupType, season, currentRound, nextRound, tournamentInfo);
            console.log(`   📊 ${nextRound}: ${generatedCount} Spiele generiert`);
            
            if (generatedCount === 0) {
                console.log(`   ⚠️ Keine Spiele für ${nextRound} generiert - stoppe`);
                break;
            }
            
            totalGenerated += generatedCount;
            generatedRounds.push(nextRound);
            
            // Setze currentRound für nächste Iteration
            console.log(`   ➡️ Setze currentRound von "${currentRound}" auf "${nextRound}"`);
            currentRound = nextRound;
            iteration++;
            
            // Sicherheits-Break nach 10 Iterationen
            if (iteration > 10) {
                console.log(`   🛑 Sicherheits-Break nach ${iteration} Iterationen`);
                break;
            }
        }
        
        console.log(`   ✅ ${totalGenerated} Prognose-Spiele in ${generatedRounds.length} Runden generiert: ${generatedRounds.join(', ')}`);
        
        return { 
            generated: totalGenerated,
            rounds: generatedRounds
        };
        
    } catch (error) {
        console.error(`❌ Fehler bei Prognose-Generierung für ${cupType} ${season}: ${error.message}`);
        console.error(error.stack);
        return { generated: 0, updated: 0, error: error.message };
    }
}

/**
 * Findet die letzte echte Runde (nicht Prognose) als Startpunkt
 */
async function findLastRealRound(db, cupType, season) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT DISTINCT roundName, COUNT(*) as gameCount,
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
                    WHEN '1/2' THEN 7
                    WHEN '1/1' THEN 8
                    ELSE 9
                END ASC
        `;
        
        db.all(sql, [cupType, season], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                console.log(`   🔍 Debug: Alle Runden für ${cupType} ${season}:`);
                
                let lastRealRound = null;
                
                for (const row of rows) {
                    const realGames = row.gameCount - row.prognoseCount;
                    const status = row.prognoseCount > 0 ? '🔮 PROGNOSE' : (realGames > 0 ? '✅ ECHT' : '❓ LEER');
                    
                    console.log(`     📊 ${row.roundName}: ${realGames} echt + ${row.prognoseCount} prognose = ${row.gameCount} total - ${status}`);
                    
                    // Nur echte Spiele zählen als "letzte reale Runde"
                    if (realGames > 0) {
                        lastRealRound = row.roundName;
                    }
                }
                
                console.log(`   📍 Letzte echte Runde: ${lastRealRound}`);
                resolve(lastRealRound);
            }
        });
    });
}

/**
 * Generiert eine Prognose-Runde basierend auf der Vorrunde
 */
async function generatePrognoseRound(db, cupType, season, currentRound, nextRound, tournamentInfo) {
    try {
        // Hole alle Spiele der aktuellen Runde (echte + bereits generierte Prognose)
        const currentRoundGames = await getAllGamesForRound(db, cupType, season, currentRound);
        
        if (currentRoundGames.length === 0) {
            console.log(`   ⚠️ Keine Spiele in ${currentRound} gefunden`);
            return 0;
        }
        
        console.log(`   📊 ${currentRoundGames.length} Spiele in ${currentRound} gefunden`);
        
        // Gruppiere Spiele paarweise für nächste Runde
        const nextRoundPairs = [];
        
        for (let i = 0; i < currentRoundGames.length; i += 2) {
            const game1 = currentRoundGames[i];
            const game2 = currentRoundGames[i + 1];
            
            const newSortOrder = Math.ceil((game1.bracketSortOrder || 1) / 2);
            
            if (game2) {
                // Zwei Spiele -> bestimme beide Teams nach Ihren Regeln
                const team1 = await determineAdvancerFromGame(db, game1);
                const team2 = await determineAdvancerFromGame(db, game2);
                
                nextRoundPairs.push({
                    team1: team1,
                    team2: team2,
                    sortOrder: newSortOrder
                });
            } else {
                // Nur ein Spiel -> automatischer Aufsteiger mit Freilos
                const team1 = await determineAdvancerFromGame(db, game1);
                
                nextRoundPairs.push({
                    team1: team1,
                    team2: 'Freilos',
                    sortOrder: newSortOrder
                });
            }
        }
        
        // Sortiere Paare nach sortOrder
        nextRoundPairs.sort((a, b) => a.sortOrder - b.sortOrder);
        
        console.log(`   🔍 Debug: ${nextRoundPairs.length} Paare für ${nextRound} erstellt`);
        
        // Generiere Spiele für nächste Runde
        let generatedCount = 0;
        
        for (let i = 0; i < nextRoundPairs.length; i++) {
            const pair = nextRoundPairs[i];
            
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
 * Bestimmt den Aufsteiger nach Ihren 5 Regeln (mit teamShorts Integration)
 */
async function determineAdvancerFromGame(db, game) {
    const team1 = game.team1;
    const team2 = game.team2;
    
    // Fall 4: Freilos vs Freilos --> Freilos
    if (team1 === 'Freilos' && team2 === 'Freilos') {
        return 'Freilos';
    }
    
    // Fall 3: Team A vs Freilos --> Team A
    if (team1 === 'Freilos') {
        return team2;
    }
    if (team2 === 'Freilos') {
        return team1;
    }
    
    // Fall 5: Team A / Team B (noch offen) --> TBA
    if (team1.includes(' / ') || team2.includes(' / ') || team1 === 'TBA' || team2 === 'TBA' || team1 === 'TBD' || team2 === 'TBD') {
        return 'TBA';
    }
    
    // Fall 2: Bereits gespielt --> Sieger
    if (game.result && game.result.trim() !== '' && game.result !== 'TBD' && game.result !== 'TBA') {
        const winner = determineWinnerFromResult(game.result, team1, team2);
        if (winner) {
            return winner;
        }
    }
    
    // Fall 1: Nicht gespielt --> Team A / Team B (mit Kurznamen)
    return await createTeamCombination(db, team1, team2);
}

/**
 * Holt alle Spiele einer Runde (echte + Prognose)
 */
async function getAllGamesForRound(db, cupType, season, roundName) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT * FROM games 
            WHERE cupType = ? AND season = ? AND roundName = ?
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
                const team1 = await determineWinnerOrAdvancer(db, game1);
                const team2 = await determineWinnerOrAdvancer(db, game2);
                
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
                const team1 = await determineWinnerOrAdvancer(db, game1);
                
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
            
            // 🔧 KORREKTE bracketSortOrder: Erste Spiel-Position / 2 GERUNDET NACH OBEN
            const newSortOrder = Math.ceil((game1.bracketSortOrder || 1) / 2);
            
            if (game2) {
                // Zwei Spiele -> TBD Paar (außer bei Freilos-Automatik)
                const team1 = determineTBDOrAdvancer(game1);
                const team2 = determineTBDOrAdvancer(game2);
                
                // Skip nur wenn beide explizit Freilos sind
                if (team1 === 'Freilos' && team2 === 'Freilos') {
                    continue;
                }
                
                nextRoundPairs.push({
                    team1: team1,
                    team2: team2,
                    sortOrder: newSortOrder
                });
            } else {
                // Nur ein Spiel -> automatischer Aufsteiger
                const team1 = determineTBDOrAdvancer(game1);
                
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
        
        console.log(`   🔍 Debug: ${nextRoundPairs.length} TBD-Paare für ${nextRound} erstellt`);
        
        // Generiere TBD-Spiele für übernächste Runde
        let generatedCount = 0;
        
        for (let i = 0; i < nextRoundPairs.length; i++) {
            const pair = nextRoundPairs[i];
            
            // Generiere auch TBD vs TBD Spiele
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
    
    // Wenn beide Teams TBD/TBA sind, bleibt es TBD
    if ((game.team1 === 'TBD' || game.team1 === 'TBA') && (game.team2 === 'TBD' || game.team2 === 'TBA')) {
        return 'TBD';
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

async function determineWinnerOrAdvancer(db, game) {
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
    
    // Fallback: Team1 / Team2 Format für unentschiedene Spiele (mit Kurznamen)
    return await createTeamCombination(db, game.team1, game.team2);
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