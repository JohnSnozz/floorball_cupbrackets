// modules/cup-routes.js - Cup-Crawling Routen mit Smart Skip Logic (PostgreSQL)

const dbHelpers = require('./database');

// Cup-Konfigurationen
const CUP_CONFIGS = {
  herren_grossfeld: {
    name: 'Mobiliar Cup Herren Grossfeld',
    gender: 'herren',
    field_type: 'grossfeld',
    search_terms: ['Cup', 'Herren', 'Männer'],
    tournament_pattern: /Cup.*Herren|Herren.*Cup|Cup.*Männer|Männer.*Cup/i
  },
  damen_grossfeld: {
    name: 'Mobiliar Cup Damen Grossfeld',
    gender: 'damen',
    field_type: 'grossfeld',
    search_terms: ['Cup', 'Damen', 'Frauen'],
    tournament_pattern: /Cup.*Damen|Damen.*Cup|Cup.*Frauen|Frauen.*Cup/i
  },
  herren_kleinfeld: {
    name: 'Liga Cup Herren Kleinfeld',
    gender: 'herren',
    field_type: 'kleinfeld',
    search_terms: ['Liga', 'Herren', 'Männer'],
    tournament_pattern: /Liga.*Cup.*Herren|Liga.*Cup.*Männer|Ligacup.*Herren|Ligacup.*Männer/i
  },
  damen_kleinfeld: {
    name: 'Liga Cup Damen Kleinfeld',
    gender: 'damen',
    field_type: 'kleinfeld',
    search_terms: ['Liga', 'Damen', 'Frauen'],
    tournament_pattern: /Liga.*Cup.*Damen|Liga.*Cup.*Frauen|Ligacup.*Damen|Ligacup.*Frauen/i
  }
};

function register(app, pool) {  // pool statt db
  console.log('🔧 Registriere Cup-Routen...');

  // GET /crawl-cup - Hauptcrawler für spezifische Cups
  app.get('/crawl-cup', async (req, res) => {
    const cuptype = req.query.cup || 'herren_grossfeld';
    const requestedSeason = req.query.season || null;
    const skipPlayed = req.query.skipPlayed === 'true'; // Neuer Parameter
    const cupConfig = CUP_CONFIGS[cuptype];
    
    if (!cupConfig) {
      return res.status(400).json({ error: 'Unbekannter Cup-Typ: ' + cuptype });
    }
    
    console.log(`🏆 Crawling ${cupConfig.name} (Saison: ${requestedSeason || 'Auto'})${skipPlayed ? ' [Skip Played]' : ''}...`);
    
    try {
      // 1. Hole aktuelle Cup-Übersicht von API
      const cupData = await fetchCupOverview();
      
      // 2. Finde relevanten Cup basierend auf cuptype und Saison
      const tournament = findRelevantTournament(cupData, cuptype, requestedSeason);
      
      if (!tournament) {
        return res.json({
          cupname: cupConfig.name,
          season: requestedSeason,
          tournaments: [],
          matches: [],
          totalgames: 0,
          newgames: 0,
          cachegames: 0,
          skippedplayed: 0,
          updatedgames: 0,
          success: false,
          errors: [`Kein passendes Turnier für ${cupConfig.name} in Saison ${requestedSeason || 'Auto'} gefunden`]
        });
      }
      
      console.log(`✅ Found tournament: ${tournament.name} (ID: ${tournament.id}, Saison: ${tournament.season})`);
      
      // 3. Hole alle Runden für dieses Turnier
      const rounds = await getCupRounds(tournament.id);
      console.log(`📊 Found ${rounds.length} rounds for tournament ${tournament.id}`);
      
      // 4. Crawle alle Spiele aus allen Runden mit Smart Logic
      let allMatches = [];
      let newgames = 0;
      let cachegames = 0;
      let skippedplayed = 0;
      let updatedgames = 0;
      let errors = [];
      
      for (let i = 0; i < rounds.length; i++) {
        const round = rounds[i];
        
        try {
          console.log(`🔍 Crawling round ${i+1}/${rounds.length}: ${round.name} (ID: ${round.id})`);
          
          // Rate limiting: 200ms delay zwischen Requests
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
          
          // Hole Spiele für beide Seiten (left/right) falls Cup-Bracket
          const leftGames = await getCupGamesByRound(tournament.id, round.id, 'left');
          
          // Kurze Pause zwischen left und right
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const rightGames = await getCupGamesByRound(tournament.id, round.id, 'right');
          
          const allRoundGames = [...leftGames, ...rightGames];
          
          // Duplikate entfernen
          const uniqueGames = allRoundGames.filter((game, index, self) => 
            index === self.findIndex(g => g.gameid === game.gameid)
          );
          
          console.log(`📊 Round ${round.name}: ${uniqueGames.length} unique games`);
          
          for (const game of uniqueGames) {
            // Erstelle konsistente gameid basierend auf Teams, Runde und Turnier ODER numerische ID
            let uniquegameid;
            if (game.numericgameid) {
              uniquegameid = `game_${game.numericgameid}`;
            } else {
              const cleanTeam1 = game.team1.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
              const cleanTeam2 = game.team2.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
              uniquegameid = `${cleanTeam1}_vs_${cleanTeam2}_r${round.id}_t${tournament.id}`;
            }
            
            // 🎯 SMART LOGIC: Prüfe existierendes Spiel
            const existingGame = await dbHelpers.getGameFromDB(pool, uniquegameid);
            
            if (existingGame) {
              // Spiel existiert bereits - prüfe ob es gespielt wurde
              const hasresult = existingGame.result && existingGame.result.trim() !== '';
              const currentresult = game.result || '';
              
              if (skipPlayed && hasresult && currentresult === existingGame.result) {
                // ⏭️ SKIP: Spiel bereits gespielt und Resultat unverändert
                skippedplayed++;
                continue; // Spiel wird NICHT zur allMatches Liste hinzugefügt
                
              } else if (hasresult && currentresult !== existingGame.result && currentresult.trim() !== '') {
                // 🔄 UPDATE: Spiel hat neues/anderes Resultat
                console.log(`🔄 UPDATE: ${game.team1} vs ${game.team2} - Resultat geändert: "${existingGame.result}" → "${currentresult}"`);
                
                await updateGameInDB(pool, uniquegameid, {
                  result: currentresult,
                  status: currentresult ? 'finished' : 'scheduled'
                });
                
                game.fromcache = false;
                game.gameid = uniquegameid;
                game.roundname = round.name;
                game.tournamentname = tournament.name;
                game.season = tournament.season;
                allMatches.push(game);
                updatedgames++;
                
              } else if (!hasresult && currentresult.trim() !== '') {
                // 🆕 NEW RESULT: Spiel war unentschieden, hat jetzt Resultat
                console.log(`🆕 NEW RESULT: ${game.team1} vs ${game.team2} - Neues Resultat: "${currentresult}"`);
                
                await updateGameInDB(pool, uniquegameid, {
                  result: currentresult,
                  status: 'finished'
                });
                
                game.fromcache = false;
                game.gameid = uniquegameid;
                game.roundname = round.name;
                game.tournamentname = tournament.name;
                game.season = tournament.season;
                allMatches.push(game);
                updatedgames++;
                
              } else {
                // 💾 CACHE: Unverändert, aus Cache
                game.fromcache = true;
                game.gameid = uniquegameid;
                game.roundname = round.name;
                game.tournamentname = tournament.name;
                game.season = tournament.season;
                allMatches.push(game);
                cachegames++;
              }
              
            } else {
              // 🔵 NEUES SPIEL: Komplett neu speichern
              console.log(`🔵 NEW GAME: ${game.team1} vs ${game.team2} will be saved`);
              
              // Neue Spieldaten aufbereiten und speichern
              const gameData = {
                gameid: uniquegameid,
                numericgameid: game.numericgameid || null,
                team1: game.team1,
                team2: game.team2,
                roundname: round.name,
                roundid: round.id,
                tournamentid: tournament.id,
                tournamentname: tournament.name,
                season: tournament.season,
                cuptype: cuptype,
                gender: cupConfig.gender,
                fieldtype: cupConfig.field_type,
                gamedate: game.gamedate || '',
                gametime: game.gametime || '',
                venue: game.venue || '',
                status: game.result ? 'finished' : 'scheduled',
                result: game.result || '',
                source: 'api',
                apiendpoint: `/api/games?mode=cup&tournament_id=${tournament.id}&round=${round.id}`,
                link: game.link || '',
                hometeamscore: game.hometeamscore || null,
                awayteamscore: game.awayteamscore || null,
                gamelocation: game.gamelocation || null,
                referees: game.referees || null,
                spectators: game.spectators || null,
                notes: game.notes || null,
                bracketsortorder: game.numericgameid || null
              };
              
              try {
                const saveResult = await dbHelpers.saveGameToDB(pool, gameData);
                if (saveResult.changes > 0) {
                  console.log(`✅ SAVED: ${game.team1} vs ${game.team2} saved to DB`);
                  game.fromcache = false;
                  game.gameid = uniquegameid;
                  game.roundname = round.name;
                  game.tournamentname = tournament.name;
                  game.season = tournament.season;
                  allMatches.push(game);
                  newgames++;
                } else {
                  console.log(`🟡 DUPLICATE via INSERT ON CONFLICT: ${game.team1} vs ${game.team2}`);
                  game.fromcache = true;
                  game.gameid = uniquegameid;
                  game.roundname = round.name;
                  game.tournamentname = tournament.name;
                  game.season = tournament.season;
                  allMatches.push(game);
                  cachegames++;
                }
              } catch (saveError) {
                console.error(`❌ SAVE ERROR: ${saveError.message}`);
                errors.push(`Fehler beim Speichern: ${game.team1} vs ${game.team2}`);
              }
            }
          }
          
        } catch (roundError) {
          console.error(`Error crawling round ${round.id}:`, roundError.message);
          errors.push(`Fehler bei Runde ${round.name}: ${roundError.message}`);
        }
      }
      
      // 📊 SUMMARY LOGGING
      console.log(`🎯 Crawling complete for ${cupConfig.name}:`);
      console.log(`   📊 Total verarbeitet: ${allMatches.length + skippedplayed} Spiele`);
      console.log(`   🆕 Neu hinzugefügt: ${newgames}`);
      console.log(`   🔄 Aktualisiert: ${updatedgames}`);
      console.log(`   💾 Aus Cache: ${cachegames}`);
      console.log(`   ⏭️ Übersprungen (bereits gespielt): ${skippedplayed}`);
      if (errors.length > 0) {
        console.log(`   ❌ Fehler: ${errors.length}`);
      }
      
      res.json({
        success: true,
        cupname: cupConfig.name,
        season: tournament.season,
        tournaments: [tournament],
        matches: allMatches,
        totalgames: allMatches.length,
        newgames: newgames,
        cachegames: cachegames,
        skippedplayed: skippedplayed,
        updatedgames: updatedgames,
        errors: errors
      });
      
    } catch (error) {
      console.error('❌ Cup crawling error:', error.message);
      res.status(500).json({ 
        success: false,
        error: error.message,
        cupname: cupConfig.name,
        season: requestedSeason,
        totalgames: 0,
        newgames: 0,
        cachegames: 0,
        skippedplayed: 0,
        updatedgames: 0,
        errors: [error.message]
      });
    }
  });

  console.log('✅ Cup-Routen registriert');
}

// 🔄 Update Game in DB - PostgreSQL-Version
async function updateGameInDB(pool, gameid, updates) {
  const fields = Object.keys(updates).map((key, index) => `"${key}" = $${index + 1}`).join(', ');
  const values = Object.values(updates);
  
  const sql = `UPDATE games SET ${fields} WHERE "gameid" = $${values.length + 1}`;
  
  const result = await pool.query(sql, [...values, gameid]);
  return { changes: result.rowCount || 0 };
}

// API helper functions (unverändert)
async function fetchCupOverview() {
  try {
    console.log('🔍 Fetching cup overview from API...');
    
    const response = await fetch('https://api-v2.swissunihockey.ch/api/cups/', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SwissCup-Crawler/1.0'
      }
    });
    
    if (response.status === 200) {
      const data = await response.json();
      console.log('✅ Cup overview fetched successfully');
      return data;
    } else {
      throw new Error(`API returned status ${response.status}`);
    }
    
  } catch (error) {
    console.error('❌ Error fetching cup overview:', error.message);
    throw error;
  }
}

function findRelevantTournament(cupData, cuptype, requestedSeason = null) {
  try {
    if (!cupData.data || !cupData.data.tabs) {
      throw new Error('Invalid cup data structure');
    }
    
    let currentSeason;
    
    if (requestedSeason) {
      currentSeason = cupData.data.tabs[0]?.entries?.find(season => 
        season.text === requestedSeason
      );
    }
    
    if (!currentSeason) {
      const fallbackSeasons = ['2024/25', '2025/26'];
      
      for (const season of fallbackSeasons) {
        currentSeason = cupData.data.tabs[0]?.entries?.find(s => s.text === season);
        if (currentSeason) break;
      }
      
      if (!currentSeason) {
        currentSeason = cupData.data.tabs[0]?.entries?.[0];
      }
    }
    
    if (!currentSeason) {
      throw new Error('No season found in API data');
    }
    
    console.log(`📅 Using season: ${currentSeason.text}`);
    
    const knownTournamentIds = {
      'herren_grossfeld': {
        '2025/26': '406151', // Mobiliar Unihockey Cup Männer
        '2024/25': '406115', // Mobiliar Unihockey Cup Herren
        '2023/24': '406044', // Mobiliar Unihockey Cup Herren
        '2022/23': '404772'  // Mobiliar Unihockey Cup Herren
      },
      'damen_grossfeld': {
        '2025/26': '406150', // Mobiliar Unihockey Cup Frauen
        '2024/25': '406114', // Mobiliar Unihockey Cup Damen  
        '2023/24': '406043', // Mobiliar Unihockey Cup Damen
        '2022/23': '404771'  // Mobiliar Unihockey Cup Damen
      },
      'herren_kleinfeld': {
        '2025/26': '406149', // Mobiliar Ligacup Männer
        '2024/25': '406112', // Ligacup Herren
        '2023/24': '406040', // Ligacup Herren
        '2022/23': '404768'  // Ligacup Herren
      },
      'damen_kleinfeld': {
        '2025/26': '406148', // Mobiliar Ligacup Frauen
        '2024/25': '406111', // Ligacup Damen
        '2023/24': '406039', // Ligacup Damen
        '2022/23': '404767'  // Ligacup Damen
      }
    };
    
    const tournamentid = knownTournamentIds[cuptype]?.[currentSeason.text];
    
    if (tournamentid) {
      const tournament = currentSeason.entries?.find(entry => 
        entry.set_in_context.tournament_id.toString() === tournamentid
      );
      
      return {
        id: tournamentid,
        name: tournament?.text || `Unknown Tournament ${tournamentid}`,
        season: currentSeason.text,
        gameCount: 0
      };
    }
    
    return null;
    
  } catch (error) {
    console.error('❌ Error finding relevant tournament:', error.message);
    return null;
  }
}

async function getCupRounds(tournamentid) {
  try {
    console.log(`🔍 Getting rounds for tournament ${tournamentid}...`);
    
    const response = await fetch(`https://api-v2.swissunihockey.ch/api/cups/?tournament_id=${tournamentid}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SwissCup-Crawler/1.0'
      }
    });
    
    if (response.status === 200) {
      const data = await response.json();
      
      if (data.data && data.data.regions && data.data.regions[0] && data.data.regions[0].rows) {
        const rounds = [];
        
        data.data.regions[0].rows.forEach(row => {
          if (row.cells && row.cells[0] && row.cells[0].link) {
            const roundid = row.cells[0].link.set_in_context.round;
            const roundname = row.cells[0].text[0];
            
            rounds.push({
              id: roundid.toString(),
              name: roundname,
              order: rounds.length + 1
            });
          }
        });
        
        console.log(`✅ Found ${rounds.length} rounds: ${rounds.map(r => r.name).join(', ')}`);
        return rounds;
      }
    }
    
    throw new Error(`Failed to get rounds for tournament ${tournamentid}`);
    
  } catch (error) {
    console.error(`❌ Error getting rounds: ${error.message}`);
    return [];
  }
}

async function getCupGamesByRound(tournamentid, roundid, side = 'left') {
  try {
    console.log(`🎮 Getting games for tournament ${tournamentid}, round ${roundid}, side ${side}...`);
    
    const endpoint = `/api/games?mode=cup&tournament_id=${tournamentid}&round=${roundid}&side=${side}`;
    
    const response = await fetch(`https://api-v2.swissunihockey.ch${endpoint}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SwissCup-Crawler/1.0'
      }
    });
    
    if (response.status === 200) {
      const data = await response.json();
      console.log(`📊 API Response for ${endpoint}:`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Regions count: ${data.data?.regions?.length || 0}`);
      
      if (data.data?.regions?.length > 0) {
        console.log(`   First region rows: ${data.data.regions[0].rows?.length || 0}`);
        if (data.data.regions[0].rows?.length > 0) {
          console.log(`   First row cells: ${data.data.regions[0].rows[0].cells?.length || 0}`);
        }
      }
      
      return parseGamesFromAPI(data);
    } else {
      console.log(`⚪ No games found for round ${roundid} side ${side} (Status: ${response.status})`);
      return [];
    }
    
  } catch (error) {
    console.log(`❌ Error getting games for round ${roundid}: ${error.message}`);
    return [];
  }
}

function parseGamesFromAPI(data) {
  console.log('🎮 Parsing games from API data...');
  
  const games = [];
  
  if (!data.data || !data.data.regions) {
    console.log('No data.data.regions found');
    return games;
  }
  
  console.log(`Found ${data.data.regions.length} regions in data.data`);
  
  data.data.regions.forEach((region, regionIndex) => {
    console.log(`  Processing region ${regionIndex}:`, { text: region.text, rows: region.rows?.length || 0 });
    
    if (!region.rows || region.rows.length === 0) {
      console.log(`    Region ${regionIndex} has no rows`);
      return;
    }
    
    region.rows.forEach((row, rowIndex) => {
      if (!row.cells || row.cells.length === 0) {
        return;
      }
      
      console.log(`    Processing row ${rowIndex}:`, row.cells.map(c => c.text).join(' | '));
      
      const numericgameid = row.id;
      console.log(`    🎯 Found numeric game ID from row.id: ${numericgameid}`);
      
      const cells = row.cells;
      
      if (cells.length >= 2) {
        const team1 = cells[0]?.text?.[0] || '';
        const team2 = cells[1]?.text?.[0] || '';
        const result = cells[2]?.text?.[0] || '';
        
        let gameLink = null;
        
        if (cells[0].link && cells[0].link.ids && cells[0].link.ids[0]) {
          const gameid = cells[0].link.ids[0];
          gameLink = `https://www.swissunihockey.ch/de/spiel/game-detail?game_id=${gameid}`;
          console.log(`    🔗 Generated game link: ${gameLink}`);
        }
        
        if (team1 && team2) {
          const game = {
            gameid: numericgameid ? `game_${numericgameid}` : `${team1}-${team2}-${Date.now()}`,
            numericgameid: numericgameid,
            team1: team1,
            team2: team2,
            result: result,
            gamedate: '',
            gametime: '',
            venue: '',
            status: result ? 'finished' : 'scheduled',
            link: gameLink || '',
            isFreilos: team1 === 'Freilos' || team2 === 'Freilos'
          };
          
          games.push(game);
          console.log(`    ✅ Created game: ${team1} vs ${team2}`);
          console.log(`       - Numeric ID: ${numericgameid}`);
          console.log(`       - Game ID: ${game.gameid}`);
          console.log(`       - Link: ${gameLink || 'NONE'}`);
        }
      }
    });
  });
  
  console.log(`🎯 Parsed ${games.length} games total`);
  
  const gamesWithNumericId = games.filter(g => g.numericgameid);
  console.log(`📊 Games with numeric ID: ${gamesWithNumericId.length}/${games.length}`);
  
  return games;
}

module.exports = {
  register
};