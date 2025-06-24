// modules/prognose-games.js - Prognose Spiele Generator (PostgreSQL)

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
async function getTeamShort(pool, teamName) {
    try {
        const sql = 'SELECT teamShort FROM teamShorts WHERE team = $1';
        const result = await pool.query(sql, [teamName]);
        return result.rows[0] ? result.rows[0].teamshort : teamName;
    } catch (err) {
        // Fallback: ursprünglicher Teamname
        return teamName;
    }
}

/**
 * Erstellt Team-Verknüpfung mit Kurznamen
 */
async function createTeamCombination(pool, team1, team2) {
    const team1Short = await getTeamShort(pool, team1);
    const team2Short = await getTeamShort(pool, team2);
    
    return `${team1Short} / ${team2Short}`;
}

/**
 * Hauptfunktion: Generiert Prognose-Spiele für eine Saison/Cup
 */
async function generatePrognoseGames(pool, cupType, season) {
    try {
        console.log(`🔮 Generiere Prognose-Spiele für ${cupType} ${season}...`);
        
        // 1. Prüfe ob überhaupt Spiele in der DB sind
        const totalGamesResult = await pool.query(
            'SELECT COUNT(*) as count FROM games WHERE cupType = $1 AND season = $2 AND source != $3', 
            [cupType, season, 'prognose']
        );
        const totalGames = totalGamesResult.rows[0] ? parseInt(totalGamesResult.rows[0].count) : 0;
        
        console.log(`   🔍 Debug: ${totalGames} Spiele in DB für ${cupType} ${season}`);
        
        if (totalGames === 0) {
            console.log(`   ❌ Keine Spiele gefunden für ${cupType} ${season} - kann keine Prognose erstellen`);
            return { generated: 0, updated: 0, error: 'Keine Spiele in DB gefunden' };
        }
        
        // 2. Finde letzte echte Runde (Startpunkt)
        const lastRealRound = await findLastRealRound(pool, cupType, season);
        if (!lastRealRound) {
            console.log(`   ❌ Keine echte Runde gefunden für ${cupType} ${season}`);
            return { generated: 0, updated: 0, error: 'Keine echte Runde gefunden' };
        }
        
        // 3. Hole Tournament-Info
        const tournamentInfo = await getTournamentInfo(pool, cupType, season);
        if (!tournamentInfo) {
            console.log(`   ❌ Tournament-Info nicht gefunden für ${cupType} ${season}`);
            return { generated: 0, updated: 0, error: 'Tournament-Info nicht gefunden' };
        }
        
        // 4. Lösche ALLE existierenden Prognose-Spiele für diesen Cup/Saison
        console.log(`   🧹 Lösche alle existierenden Prognose-Spiele...`);
        await deleteAllPrognoseGames(pool, cupType, season);
        
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
            const generatedCount = await generatePrognoseRound(pool, cupType, season, currentRound, nextRound, tournamentInfo);
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
async function findLastRealRound(pool, cupType, season) {
    const sql = `
        SELECT roundName, COUNT(*) as gameCount,
               COUNT(CASE WHEN source = 'prognose' THEN 1 END) as prognoseCount
        FROM games 
        WHERE cupType = $1 AND season = $2
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
    
    const result = await pool.query(sql, [cupType, season]);
    const rows = result.rows;
    
    console.log(`   🔍 Debug: Alle Runden für ${cupType} ${season}:`);
    
    let lastRealRound = null;
    
    for (const row of rows) {
        const realGames = parseInt(row.gamecount) - parseInt(row.prognosecount);
        const status = parseInt(row.prognosecount) > 0 ? '🔮 PROGNOSE' : (realGames > 0 ? '✅ ECHT' : '❓ LEER');
        
        console.log(`     📊 ${row.roundname}: ${realGames} echt + ${row.prognosecount} prognose = ${row.gamecount} total - ${status}`);
        
        // Nur echte Spiele zählen als "letzte reale Runde"
        if (realGames > 0) {
            lastRealRound = row.roundname;
        }
    }
    
    console.log(`   📍 Letzte echte Runde: ${lastRealRound}`);
    return lastRealRound;
}

/**
 * Generiert eine Prognose-Runde basierend auf der Vorrunde
 */
async function generatePrognoseRound(pool, cupType, season, currentRound, nextRound, tournamentInfo) {
    try {
        // Hole alle Spiele der aktuellen Runde (echte + bereits generierte Prognose)
        const currentRoundGames = await getAllGamesForRound(pool, cupType, season, currentRound);
        
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
            
            const newSortOrder = Math.ceil((game1.bracketsortorder || 1) / 2);
            
            if (game2) {
                // Zwei Spiele -> bestimme beide Teams nach Ihren Regeln
                const team1 = await determineAdvancerFromGame(pool, game1);
                const team2 = await determineAdvancerFromGame(pool, game2);
                
                nextRoundPairs.push({
                    team1: team1,
                    team2: team2,
                    sortOrder: newSortOrder
                });
            } else {
                // Nur ein Spiel -> automatischer Aufsteiger mit Freilos
                const team1 = await determineAdvancerFromGame(pool, game1);
                
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
                gameId: await generateUniquePrognoseId(pool),
                team1: pair.team1,
                team2: pair.team2,
                roundName: nextRound,
                roundId: await getNextRoundId(pool, cupType, season),
                tournamentId: tournamentInfo.tournamentid,
                tournamentName: tournamentInfo.tournamentname,
                season: season,
                cupType: cupType,
                gender: tournamentInfo.gender,
                fieldType: tournamentInfo.fieldtype,
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
                await savePrognoseGame(pool, gameData);
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
async function determineAdvancerFromGame(pool, game) {
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
    return await createTeamCombination(pool, team1, team2);
}

/**
 * Holt alle Spiele einer Runde (echte + Prognose)
 */
async function getAllGamesForRound(pool, cupType, season, roundName) {
    const sql = `
        SELECT * FROM games 
        WHERE cupType = $1 AND season = $2 AND roundName = $3
        ORDER BY bracketSortOrder ASC, gameId ASC
    `;
    
    const result = await pool.query(sql, [cupType, season, roundName]);
    return result.rows || [];
}

/**
 * Holt Tournament-Informationen für Prognose-Spiele
 */
async function getTournamentInfo(pool, cupType, season) {
    const sql = `
        SELECT DISTINCT tournamentId, tournamentName, gender, fieldType
        FROM games 
        WHERE cupType = $1 AND season = $2
        LIMIT 1
    `;
    
    const result = await pool.query(sql, [cupType, season]);
    return result.rows[0] || null;
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
 * Generiert eine eindeutige Prognose-ID
 */
async function generateUniquePrognoseId(pool) {
    // Finde die höchste bestehende Prognose-ID
    const sql = `
        SELECT gameId FROM games 
        WHERE gameId LIKE 'prognose_%'
        ORDER BY CAST(SUBSTRING(gameId, 10) AS INTEGER) DESC
        LIMIT 1
    `;
    
    const result = await pool.query(sql, []);
    const row = result.rows[0];
    
    let nextNumber = 1;
    
    if (row && row.gameid) {
        const currentNumber = parseInt(row.gameid.replace('prognose_', ''));
        if (!isNaN(currentNumber)) {
            nextNumber = currentNumber + 1;
        }
    }
    
    // Formatiere mit führenden Nullen (7 Stellen)
    const paddedNumber = nextNumber.toString().padStart(7, '0');
    return `prognose_${paddedNumber}`;
}

/**
 * Bestimmt die nächste Round-ID
 */
async function getNextRoundId(pool, cupType, season) {
    const sql = `
        SELECT MAX(CAST(roundId AS INTEGER)) as maxRoundId
        FROM games 
        WHERE cupType = $1 AND season = $2
    `;
    
    const result = await pool.query(sql, [cupType, season]);
    const row = result.rows[0];
    const nextRoundId = (row && row.maxroundid) ? row.maxroundid + 1 : 1000;
    return nextRoundId.toString();
}

/**
 * Speichert ein Prognose-Spiel in die Datenbank
 */
async function savePrognoseGame(pool, gameData) {
    const sql = `
        INSERT INTO games (
            gameId, team1, team2, roundName, roundId, tournamentId, tournamentName,
            season, cupType, gender, fieldType, gameDate, gameTime, venue, status,
            result, source, apiEndpoint, link, homeTeamScore, awayTeamScore,
            gameLocation, referees, spectators, notes, numericGameId, bracketSortOrder
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
    `;
    
    const values = [
        gameData.gameId, gameData.team1, gameData.team2, gameData.roundName,
        gameData.roundId, gameData.tournamentId, gameData.tournamentName,
        gameData.season, gameData.cupType, gameData.gender, gameData.fieldType,
        gameData.gameDate, gameData.gameTime, gameData.venue, gameData.status,
        gameData.result, gameData.source, gameData.apiEndpoint, gameData.link,
        gameData.homeTeamScore || null, gameData.awayTeamScore || null,
        gameData.gameLocation || null, gameData.referees || null,
        gameData.spectators || null, gameData.notes || null,
        gameData.numericGameId || null, gameData.bracketSortOrder || null
    ];
    
    const result = await pool.query(sql, values);
    return { changes: result.rowCount || 0 };
}

/**
 * Löscht alle Prognose-Spiele für einen Cup/Saison
 */
async function deleteAllPrognoseGames(pool, cupType, season) {
    const sql = `
        DELETE FROM games 
        WHERE cupType = $1 AND season = $2 AND source = 'prognose'
    `;
    
    const result = await pool.query(sql, [cupType, season]);
    console.log(`   🗑️ ${result.rowCount} Prognose-Spiele für ${cupType} ${season} gelöscht`);
    return result.rowCount;
}

/**
 * Generiert Prognose-Spiele für alle aktuellen Cups
 */
async function generatePrognoseForAllCups(pool, season) {
    const CUPS = ['herren_grossfeld', 'damen_grossfeld', 'herren_kleinfeld', 'damen_kleinfeld'];
    
    console.log(`🔮 Generiere Prognose-Spiele für alle Cups (Saison ${season})...`);
    
    let totalGenerated = 0;
    const results = [];
    
    for (const cupType of CUPS) {
        try {
            console.log(`\n🏆 ${getCupDisplayName(cupType)}:`);
            const result = await generatePrognoseGames(pool, cupType, season);
            
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
function register(app, pool) {
    console.log('🔧 Registriere Prognose-Routen...');
    
    // GET /generate-prognose - Generiert Prognose für einen spezifischen Cup
    app.get('/generate-prognose', async (req, res) => {
        const cupType = req.query.cup || 'herren_grossfeld';
        const season = req.query.season || '2025/26';
        
        try {
            const result = await generatePrognoseGames(pool, cupType, season);
            
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