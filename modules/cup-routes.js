// modules/cup-routes.js - Cup-Crawling Routen

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

function register(app, db) {
  console.log('🔧 Registriere Cup-Routen...');

  // GET /crawl-cup - Hauptcrawler für spezifische Cups
  app.get('/crawl-cup', async (req, res) => {
    const cupType = req.query.cup || 'herren_grossfeld';
    const requestedSeason = req.query.season || null;
    const cupConfig = CUP_CONFIGS[cupType];
    
    if (!cupConfig) {
      return res.status(400).json({ error: 'Unbekannter Cup-Typ: ' + cupType });
    }
    
    console.log(`🏆 Crawling ${cupConfig.name} (Saison: ${requestedSeason || 'Auto'})...`);
    
    try {
      // 1. Hole aktuelle Cup-Übersicht von API
      const cupData = await fetchCupOverview();
      
      // 2. Finde relevanten Cup basierend auf cupType und Saison
      const tournament = findRelevantTournament(cupData, cupType, requestedSeason);
      
      if (!tournament) {
        return res.json({
          cupName: cupConfig.name,
          season: requestedSeason,
          tournaments: [],
          matches: [],
          totalGames: 0,
          fromCache: 0,
          newlyCrawled: 0,
          errors: [`Kein passendes Turnier für ${cupConfig.name} in Saison ${requestedSeason || 'Auto'} gefunden`]
        });
      }
      
      console.log(`✅ Found tournament: ${tournament.name} (ID: ${tournament.id}, Saison: ${tournament.season})`);
      
      // 3. Hole alle Runden für dieses Turnier
      const rounds = await getCupRounds(tournament.id);
      console.log(`📊 Found ${rounds.length} rounds for tournament ${tournament.id}`);
      
      // 4. Crawle alle Spiele aus allen Runden
      let allMatches = [];
      let fromCache = 0;
      let newlyCrawled = 0;
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
            index === self.findIndex(g => g.gameId === game.gameId)
          );
          
          console.log(`📊 Round ${round.name}: ${uniqueGames.length} unique games`);
          
          for (const game of uniqueGames) {
            // Erstelle konsistente gameId basierend auf Teams, Runde und Turnier ODER numerische ID
            let uniqueGameId;
            if (game.numericGameId) {
              uniqueGameId = `game_${game.numericGameId}`;
            } else {
              const cleanTeam1 = game.team1.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
              const cleanTeam2 = game.team2.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
              uniqueGameId = `${cleanTeam1}_vs_${cleanTeam2}_r${round.id}_t${tournament.id}`;
            }
            
            console.log(`🔍 Checking game: ${game.team1} vs ${game.team2} (ID: ${uniqueGameId})`);
            
            // Prüfe ob Spiel bereits in DB existiert
            const existingGame = await dbHelpers.getGameFromDB(db, uniqueGameId);
            
            if (existingGame) {
              console.log(`🟡 DUPLICATE FOUND: ${game.team1} vs ${game.team2} already exists in DB`);
              game.fromCache = true;
              game.gameId = uniqueGameId;
              fromCache++;
            } else {
              console.log(`🔵 NEW GAME: ${game.team1} vs ${game.team2} will be saved`);
              
              // Neue Spieldaten aufbereiten und speichern
              const gameData = {
                gameId: uniqueGameId,
                numericGameId: game.numericGameId || null,
                team1: game.team1,
                team2: game.team2,
                roundName: round.name,
                roundId: round.id,
                tournamentId: tournament.id,
                tournamentName: tournament.name,
                season: tournament.season,
                cupType: cupType,
                gender: cupConfig.gender,
                fieldType: cupConfig.field_type,
                gameDate: game.gameDate || '',
                gameTime: game.gameTime || '',
                venue: game.venue || '',
                status: game.status || 'scheduled',
                result: game.result || '',
                source: 'api',
                apiEndpoint: `/api/games?mode=cup&tournament_id=${tournament.id}&round=${round.id}`,
                link: game.link || '',
                homeTeamScore: game.homeTeamScore || null,
                awayTeamScore: game.awayTeamScore || null,
                gameLocation: game.gameLocation || null,
                referees: game.referees || null,
                spectators: game.spectators || null,
                notes: game.notes || null,
                bracketSortOrder: game.numericGameId || null
              };
              
              try {
                const saveResult = await dbHelpers.saveGameToDB(db, gameData);
                if (saveResult.changes > 0) {
                  console.log(`✅ SAVED: ${game.team1} vs ${game.team2} saved to DB`);
                  game.fromCache = false;
                  game.gameId = uniqueGameId;
                  newlyCrawled++;
                } else {
                  console.log(`🟡 DUPLICATE via INSERT IGNORE: ${game.team1} vs ${game.team2}`);
                  game.fromCache = true;
                  game.gameId = uniqueGameId;
                  fromCache++;
                }
              } catch (saveError) {
                console.error(`❌ SAVE ERROR: ${saveError.message}`);
                // Behandle als Duplikat bei Fehlern
                game.fromCache = true;
                game.gameId = uniqueGameId;
                fromCache++;
              }
            }
            
            game.roundName = round.name;
            game.tournamentName = tournament.name;
            game.season = tournament.season;
          }
          
          allMatches = allMatches.concat(uniqueGames);
          
        } catch (roundError) {
          console.error(`Error crawling round ${round.id}:`, roundError.message);
          errors.push(`Fehler bei Runde ${round.name}: ${roundError.message}`);
        }
      }
      
      console.log(`🎯 Crawling complete: ${allMatches.length} total games, ${fromCache} from cache, ${newlyCrawled} newly crawled`);
      
      res.json({
        cupName: cupConfig.name,
        season: tournament.season,
        tournaments: [tournament],
        matches: allMatches,
        totalGames: allMatches.length,
        fromCache: fromCache,
        newlyCrawled: newlyCrawled,
        errors: errors
      });
      
    } catch (error) {
      console.error('❌ Cup crawling error:', error.message);
      res.status(500).json({ 
        error: error.message,
        cupName: cupConfig.name,
        season: requestedSeason,
        totalGames: 0,
        newlyCrawled: 0,
        fromCache: 0,
        errors: [error.message]
      });
    }
  });

  console.log('✅ Cup-Routen registriert');
}

// API helper functions
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

function findRelevantTournament(cupData, cupType, requestedSeason = null) {
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
    
    const tournamentId = knownTournamentIds[cupType]?.[currentSeason.text];
    
    if (tournamentId) {
      const tournament = currentSeason.entries?.find(entry => 
        entry.set_in_context.tournament_id.toString() === tournamentId
      );
      
      return {
        id: tournamentId,
        name: tournament?.text || `Unknown Tournament ${tournamentId}`,
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

async function getCupRounds(tournamentId) {
  try {
    console.log(`🔍 Getting rounds for tournament ${tournamentId}...`);
    
    const response = await fetch(`https://api-v2.swissunihockey.ch/api/cups/?tournament_id=${tournamentId}`, {
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
            const roundId = row.cells[0].link.set_in_context.round;
            const roundName = row.cells[0].text[0];
            
            rounds.push({
              id: roundId.toString(),
              name: roundName,
              order: rounds.length + 1
            });
          }
        });
        
        console.log(`✅ Found ${rounds.length} rounds: ${rounds.map(r => r.name).join(', ')}`);
        return rounds;
      }
    }
    
    throw new Error(`Failed to get rounds for tournament ${tournamentId}`);
    
  } catch (error) {
    console.error(`❌ Error getting rounds: ${error.message}`);
    return [];
  }
}

async function getCupGamesByRound(tournamentId, roundId, side = 'left') {
  try {
    console.log(`🎮 Getting games for tournament ${tournamentId}, round ${roundId}, side ${side}...`);
    
    const endpoint = `/api/games?mode=cup&tournament_id=${tournamentId}&round=${roundId}&side=${side}`;
    
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
      console.log(`⚪ No games found for round ${roundId} side ${side} (Status: ${response.status})`);
      return [];
    }
    
  } catch (error) {
    console.log(`❌ Error getting games for round ${roundId}: ${error.message}`);
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
      
      const numericGameId = row.id;
      console.log(`    🎯 Found numeric game ID from row.id: ${numericGameId}`);
      
      const cells = row.cells;
      
      if (cells.length >= 2) {
        const team1 = cells[0]?.text?.[0] || '';
        const team2 = cells[1]?.text?.[0] || '';
        const result = cells[2]?.text?.[0] || '';
        
        let gameLink = null;
        
        if (cells[0].link && cells[0].link.ids && cells[0].link.ids[0]) {
          const gameId = cells[0].link.ids[0];
          gameLink = `https://www.swissunihockey.ch/de/spiel/game-detail?game_id=${gameId}`;
          console.log(`    🔗 Generated game link: ${gameLink}`);
        }
        
        if (team1 && team2) {
          const game = {
            gameId: numericGameId ? `game_${numericGameId}` : `${team1}-${team2}-${Date.now()}`,
            numericGameId: numericGameId,
            team1: team1,
            team2: team2,
            result: result,
            gameDate: '',
            gameTime: '',
            venue: '',
            status: result ? 'finished' : 'scheduled',
            link: gameLink || '',
            isFreilos: team1 === 'Freilos' || team2 === 'Freilos'
          };
          
          games.push(game);
          console.log(`    ✅ Created game: ${team1} vs ${team2}`);
          console.log(`       - Numeric ID: ${numericGameId}`);
          console.log(`       - Game ID: ${game.gameId}`);
          console.log(`       - Link: ${gameLink || 'NONE'}`);
        }
      }
    });
  });
  
  console.log(`🎯 Parsed ${games.length} games total`);
  
  const gamesWithNumericId = games.filter(g => g.numericGameId);
  console.log(`📊 Games with numeric ID: ${gamesWithNumericId.length}/${games.length}`);
  
  return games;
}

module.exports = {
  register
};