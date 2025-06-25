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
        const sql = 'SELECT teamshort FROM teamshorts WHERE team = $1';
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
async function generatePrognoseGames(pool, cuptype, season) {
    try {
        console.log(`🔮 Generiere Prognose-Spiele für ${cuptype} ${season}...`);
        
        // 1. Prüfe ob überhaupt Spiele in der DB sind
        const totalGamesResult = await pool.query(
            'SELECT COUNT(*) as count FROM games WHERE cuptype = $1 AND season = $2 AND source != $3', 
            [cuptype, season, 'prognose']
        );
        const totalGames = totalGamesResult.rows[0] ? parseInt(totalGamesResult.rows[0].count) : 0;
        
        console.log(`   🔍 Debug: ${totalGames} Spiele in DB für ${cuptype} ${season}`);
        
        if (totalGames === 0) {
            console.log(`   ❌ Keine Spiele gefunden für ${cuptype} ${season} - kann keine Prognose erstellen`);
            return { generated: 0, updated: 0, error: 'Keine Spiele in DB gefunden' };
        }
        
        // 2. Finde letzte echte Runde (Startpunkt)
        const lastRealRound = await findLastRealRound(pool, cuptype, season);
        if (!lastRealRound) {
            console.log(`   ❌ Keine echte Runde gefunden für ${cuptype} ${season}`);
            return { generated: 0, updated: 0, error: 'Keine echte Runde gefunden' };
        }
        
        // 3. Hole Tournament-Info
        const tournamentInfo = await getTournamentInfo(pool, cuptype, season);
        if (!tournamentInfo) {
            console.log(`   ❌ Tournament-Info nicht gefunden für ${cuptype} ${season}`);
            return { generated: 0, updated: 0, error: 'Tournament-Info nicht gefunden' };
        }
        
        // 4. Lösche ALLE existierenden Prognose-Spiele für diesen Cup/Saison
        console.log(`   🧹 Lösche alle existierenden Prognose-Spiele...`);
        await deleteAllPrognoseGames(pool, cuptype, season);
        
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
            const generatedCount = await generatePrognoseRound(pool, cuptype, season, currentRound, nextRound, tournamentInfo);
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
        console.error(`❌ Fehler bei Prognose-Generierung für ${cuptype} ${season}: ${error.message}`);
        console.error(error.stack);
        return { generated: 0, updated: 0, error: error.message };
    }
}

/**
 * Findet die letzte echte Runde (nicht Prognose) als Startpunkt
 */
async function findLastRealRound(pool, cuptype, season) {
    const sql = `
        SELECT roundname, COUNT(*) as gamecount,
               COUNT(CASE WHEN source = 'prognose' THEN 1 END) as prognosecount
        FROM games 
        WHERE cuptype = $1 AND season = $2
        GROUP BY roundname
        ORDER BY 
            CASE roundname 
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
    
    const result = await pool.query(sql, [cuptype, season]);
    const rows = result.rows;
    
    console.log(`   🔍 Debug: Alle Runden für ${cuptype} ${season}:`);
    
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
async function generatePrognoseRound(pool, cuptype, season, currentRound, nextRound, tournamentInfo) {
    try {
        // Hole alle Spiele der aktuellen Runde (echte + bereits generierte Prognose)
        const currentRoundGames = await getAllGamesForRound(pool, cuptype, season, currentRound);
        
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
            
            // KORRIGIERT: PostgreSQL lowercase Feldname
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
                gameid: await generateUniquePrognoseId(pool),
                team1: pair.team1,
                team2: pair.team2,
                roundname: nextRound,
                roundid: await getNextRoundId(pool, cuptype, season),
                tournamentid: tournamentInfo.tournamentid,
                tournamentname: tournamentInfo.tournamentname,
                season: season,
                cuptype: cuptype,
                gender: tournamentInfo.gender,
                fieldtype: tournamentInfo.fieldtype,
                gamedate: '',
                gametime: '',
                venue: '',
                status: 'prognose',
                result: 'TBD',
                source: 'prognose',
                apiendpoint: '',
                link: '',
                hometeamscore: null,
                awayteamscore: null,
                gamelocation: null,
                referees: null,
                spectators: null,
                notes: 'Automatisch generierte Prognose',
                numericgameid: null,
                bracketsortorder: pair.sortOrder
            };
            
            try {
                await savePrognoseGame(pool, gameData);
                generatedCount++;
                console.log(`   ✅ ${pair.team1} vs ${pair.team2} (${nextRound}) - ID: ${gameData.gameid}`);
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
async function getAllGamesForRound(pool, cuptype, season, roundname) {
    const sql = `
        SELECT * FROM games 
        WHERE cuptype = $1 AND season = $2 AND roundname = $3
        ORDER BY bracketsortorder ASC, gameid ASC
    `;
    
    const result = await pool.query(sql, [cuptype, season, roundname]);
    return result.rows || [];
}

/**
 * Holt Tournament-Informationen für Prognose-Spiele
 */
async function getTournamentInfo(pool, cuptype, season) {
    const sql = `
        SELECT DISTINCT tournamentid, tournamentname, gender, fieldtype
        FROM games 
        WHERE cuptype = $1 AND season = $2
        LIMIT 1
    `;
    
    const result = await pool.query(sql, [cuptype, season]);
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
        SELECT gameid FROM games 
        WHERE gameid LIKE 'prognose_%'
        ORDER BY CAST(SUBSTRING(gameid, 10) AS INTEGER) DESC
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
async function getNextRoundId(pool, cuptype, season) {
    const sql = `
        SELECT MAX(CAST(roundid AS INTEGER)) as maxroundid
        FROM games 
        WHERE cuptype = $1 AND season = $2
    `;
    
    const result = await pool.query(sql, [cuptype, season]);
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
            gameid, team1, team2, roundname, roundid, tournamentid, tournamentname,
            season, cuptype, gender, fieldtype, gamedate, gametime, venue, status,
            result, source, apiendpoint, link, hometeamscore, awayteamscore,
            gamelocation, referees, spectators, notes, numericgameid, bracketsortorder 
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
    `;
    
    const values = [
        gameData.gameid, gameData.team1, gameData.team2, gameData.roundname,
        gameData.roundid, gameData.tournamentid, gameData.tournamentname,
        gameData.season, gameData.cuptype, gameData.gender, gameData.fieldtype,
        gameData.gamedate, gameData.gametime, gameData.venue, gameData.status,
        gameData.result, gameData.source, gameData.apiendpoint, gameData.link,
        gameData.hometeamscore || null, gameData.awayteamscore || null,
        gameData.gamelocation || null, gameData.referees || null,
        gameData.spectators || null, gameData.notes || null,
        gameData.numericgameid || null, gameData.bracketsortorder || null
    ];
    
    const result = await pool.query(sql, values);
    return { changes: result.rowCount || 0 };
}

/**
 * Löscht alle Prognose-Spiele für einen Cup/Saison
 */
async function deleteAllPrognoseGames(pool, cuptype, season) {
    const sql = `
        DELETE FROM games 
        WHERE cuptype = $1 AND season = $2 AND source = 'prognose'
    `;
    
    const result = await pool.query(sql, [cuptype, season]);
    console.log(`   🗑️ ${result.rowCount} Prognose-Spiele für ${cuptype} ${season} gelöscht`);
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
    
    for (const cuptype of CUPS) {
        try {
            console.log(`\n🏆 ${getCupDisplayName(cuptype)}:`);
            const result = await generatePrognoseGames(pool, cuptype, season);
            
            totalGenerated += result.generated;
            results.push({
                cuptype: cuptype,
                ...result
            });
            
        } catch (error) {
            console.error(`❌ Fehler bei ${cuptype}: ${error.message}`);
            results.push({
                cuptype: cuptype,
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
function getCupDisplayName(cuptype) {
    const names = {
        'herren_grossfeld': '🏒 Herren Grossfeld',
        'damen_grossfeld': '🏒 Damen Grossfeld',
        'herren_kleinfeld': '🏑 Herren Kleinfeld',
        'damen_kleinfeld': '🏑 Damen Kleinfeld'
    };
    return names[cuptype] || cuptype;
}

/**
 * API Route Registration
 */
function register(app, pool) {
    console.log('🔧 Registriere Prognose-Routen...');
    
    // GET /generate-prognose - Generiert Prognose für einen spezifischen Cup
    app.get('/generate-prognose', async (req, res) => {
        const cuptype = req.query.cup || 'herren_grossfeld';
        const season = req.query.season || '2025/26';
        
        try {
            const result = await generatePrognoseGames(pool, cuptype, season);
            
            res.json({
                success: true,
                cuptype: cuptype,
                season: season,
                ...result
            });
            
        } catch (error) {
            console.error('❌ Prognose API Error:', error.message);
            res.status(500).json({
                success: false,
                error: error.message,
                cuptype: cuptype,
                season: season
            });
        }
    });
    
    console.log('✅ Prognose-Routen registriert');
}

/**
 * Erweiterte deleteAllPrognoseGames Funktion - jetzt für beliebige Season
 */
async function deleteAllPrognoseGames(pool, cuptype, season) {
    const sql = `
        DELETE FROM games 
        WHERE cuptype = $1 AND season = $2 AND source = 'prognose'
    `;
    
    const result = await pool.query(sql, [cuptype, season]);
    const deletedCount = result.rowCount || 0;
    
    console.log(`   🗑️ ${deletedCount} Prognose-Spiele für ${cuptype} ${season} gelöscht`);
    return deletedCount;
}

/**
 * Löscht Prognose-Spiele für alle Cups einer Season
 */
async function deletePrognoseForAllCupsInSeason(pool, season) {
    const CUPS = ['herren_grossfeld', 'damen_grossfeld', 'herren_kleinfeld', 'damen_kleinfeld'];
    
    console.log(`🗑️ Lösche Prognose-Spiele für alle Cups (Saison ${season})...`);
    
    let totalDeleted = 0;
    const results = [];
    
    for (const cuptype of CUPS) {
        try {
            const deleted = await deleteAllPrognoseGames(pool, cuptype, season);
            totalDeleted += deleted;
            results.push({
                cuptype: cuptype,
                deleted: deleted
            });
            
        } catch (error) {
            console.error(`❌ Fehler beim Löschen ${cuptype}: ${error.message}`);
            results.push({
                cuptype: cuptype,
                deleted: 0,
                error: error.message
            });
        }
    }
    
    console.log(`📊 Prognose-Löschung abgeschlossen: ${totalDeleted} Spiele gelöscht`);
    
    return {
        totalDeleted: totalDeleted,
        results: results
    };
}

// In der exports am Ende hinzufügen:
module.exports = {
    generatePrognoseGames,
    generatePrognoseForAllCups,
    deleteAllPrognoseGames,
    deletePrognoseForAllCupsInSeason, // ← NEU
    register
};