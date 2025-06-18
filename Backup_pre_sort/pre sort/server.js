const puppeteer = require('puppeteer');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// SQLite Database Setup
const db = new sqlite3.Database('cup_games.db');

// Initialize database tables
db.serialize(() => {
  // Prüfe ob die Tabelle existiert und aktualisiere sie falls nötig
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='games'", (err, row) => {
    if (row) {
      // Tabelle existiert, füge fehlende Spalten hinzu
      console.log('🔄 Updating existing games table...');
      
      const newColumns = [
        'homeTeamScore TEXT',
        'awayTeamScore TEXT', 
        'gameLocation TEXT',
        'referees TEXT',
        'spectators INTEGER',
        'notes TEXT',
        'numericGameId INTEGER',
        'updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP'
      ];
      
      newColumns.forEach(column => {
        const columnName = column.split(' ')[0];
        db.run(`ALTER TABLE games ADD COLUMN ${column}`, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error(`Error adding column ${columnName}:`, err.message);
          } else if (!err) {
            console.log(`✅ Added column: ${columnName}`);
          }
        });
      });
      
      // Stelle sicher, dass wichtige Spalten NOT NULL constraints haben
      db.run(`UPDATE games SET status = 'scheduled' WHERE status IS NULL`);
      db.run(`UPDATE games SET source = 'api' WHERE source IS NULL`);
      
    } else {
      // Tabelle existiert nicht, erstelle sie komplett neu
      console.log('🆕 Creating new games table...');
      db.run(`
        CREATE TABLE games (
          gameId TEXT PRIMARY KEY,
          team1 TEXT NOT NULL,
          team2 TEXT NOT NULL,
          roundName TEXT,
          roundId TEXT,
          tournamentId TEXT NOT NULL,
          tournamentName TEXT,
          season TEXT NOT NULL,
          cupType TEXT NOT NULL,
          gender TEXT,
          fieldType TEXT,
          gameDate TEXT,
          gameTime TEXT,
          venue TEXT,
          status TEXT DEFAULT 'scheduled',
          result TEXT,
          source TEXT DEFAULT 'api',
          apiEndpoint TEXT,
          link TEXT,
          homeTeamScore TEXT,
          awayTeamScore TEXT,
          gameLocation TEXT,
          referees TEXT,
          spectators INTEGER,
          notes TEXT,
          numericGameId INTEGER,
          crawledAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }
  });
  
  // Index für bessere Performance (mit IF NOT EXISTS)
  setTimeout(() => {
    db.run(`CREATE INDEX IF NOT EXISTS idx_season_cup ON games(season, cupType)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_tournament ON games(tournamentId)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_status ON games(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_numeric_game_id ON games(numericGameId)`);
  }, 1000);
});

console.log('✅ SQLite database initialized');

// Cup Configurations
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

// Database helper functions
async function getGameFromDB(gameId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM games WHERE gameId = ?', [gameId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function saveGameToDB(gameData) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO games 
      (gameId, team1, team2, roundName, roundId, tournamentId, tournamentName, 
       season, cupType, gender, fieldType, gameDate, gameTime, venue, status, 
       result, source, apiEndpoint, link, homeTeamScore, awayTeamScore, 
       gameLocation, referees, spectators, notes, numericGameId, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    stmt.run([
      gameData.gameId, gameData.team1, gameData.team2, gameData.roundName,
      gameData.roundId, gameData.tournamentId, gameData.tournamentName,
      gameData.season, gameData.cupType, gameData.gender, gameData.fieldType,
      gameData.gameDate, gameData.gameTime, gameData.venue, gameData.status,
      gameData.result, gameData.source, gameData.apiEndpoint, gameData.link,
      gameData.homeTeamScore || null, gameData.awayTeamScore || null,
      gameData.gameLocation || null, gameData.referees || null,
      gameData.spectators || null, gameData.notes || null,
      gameData.numericGameId || null
    ], function(err) {
      if (err) {
        console.error(`❌ Database error for game ${gameData.gameId}:`, err.message);
        reject(err);
      } else {
        // this.changes zeigt ob ein INSERT stattgefunden hat
        if (this.changes > 0) {
          console.log(`✅ Successfully inserted game ${gameData.gameId} (numeric ID: ${gameData.numericGameId || 'N/A'})`);
        } else {
          console.log(`🟡 Game ${gameData.gameId} already exists (INSERT IGNORED)`);
        }
        resolve({ changes: this.changes, lastID: this.lastID });
      }
    });
    
    stmt.finalize();
  });
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
    // Parse die Cup-Daten um das richtige Turnier zu finden
    if (!cupData.data || !cupData.data.tabs) {
      throw new Error('Invalid cup data structure');
    }
    
    // Finde die gewünschte Saison oder fallback
    let currentSeason;
    
    if (requestedSeason) {
      currentSeason = cupData.data.tabs[0]?.entries?.find(season => 
        season.text === requestedSeason
      );
    }
    
    if (!currentSeason) {
      // Fallback-Reihenfolge: 2024/25 -> 2025/26 -> erste verfügbare
      const fallbackSeasons = ['2024/25', '2025/26'];
      
      for (const season of fallbackSeasons) {
        currentSeason = cupData.data.tabs[0]?.entries?.find(s => s.text === season);
        if (currentSeason) break;
      }
      
      // Falls immer noch nichts gefunden, nimm die erste verfügbare
      if (!currentSeason) {
        currentSeason = cupData.data.tabs[0]?.entries?.[0];
      }
    }
    
    if (!currentSeason) {
      throw new Error('No season found in API data');
    }
    
    console.log(`📅 Using season: ${currentSeason.text}`);
    
    // Verwende die exakten Tournament IDs für alle Saisons
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
      // Finde den Namen aus der API-Response
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
    
    // Verwende den Cups-Endpoint mit tournament_id
    const response = await fetch(`https://api-v2.swissunihockey.ch/api/cups/?tournament_id=${tournamentId}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SwissCup-Crawler/1.0'
      }
    });
    
    if (response.status === 200) {
      const data = await response.json();
      
      // Parse Runden aus der API-Antwort
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
    
    // KORRIGIERT: Parameter heißt "round", nicht "round_id"!
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
      
      // Debug: Zeige erste Region falls vorhanden
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
      
      // WICHTIG: Die numerische Game-ID steht im row.id Feld!
      const numericGameId = row.id;
      console.log(`    🎯 Found numeric game ID from row.id: ${numericGameId}`);
      
      // Parse game data from cells
      const cells = row.cells;
      
      if (cells.length >= 2) {
        // Extract team names and result
        const team1 = cells[0]?.text?.[0] || '';
        const team2 = cells[1]?.text?.[0] || '';
        const result = cells[2]?.text?.[0] || '';
        
        // Extract game link
        let gameLink = null;
        
        // Der Link steht in der ersten Zelle
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
  
  // DEBUG: Zeige Zusammenfassung der numerischen IDs
  const gamesWithNumericId = games.filter(g => g.numericGameId);
  console.log(`📊 Games with numeric ID: ${gamesWithNumericId.length}/${games.length}`);
  
  return games;
}

// Hauptcrawler für spezifische Cups
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
    
    // Prüfe zuerst, ob die API überhaupt Spiele liefert
    let apiHasGames = false;
    
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
        
        if (uniqueGames.length > 0) {
          apiHasGames = true;
        }
        
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
          const existingGame = await getGameFromDB(uniqueGameId);
          
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
              notes: game.notes || null
            };
            
            try {
              const saveResult = await saveGameToDB(gameData);
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
    console.error('Cup crawling error:', error);
    res.status(500).json({ 
      error: error.message,
      cupName: cupConfig.name,
      season: requestedSeason
    });
  }
});

// Routen für Spiele
app.get('/games', async (req, res) => {
  const cupType = req.query.cup;
  const season = req.query.season;
  const limit = parseInt(req.query.limit) || 100000;
  
  let query = 'SELECT * FROM games ORDER BY crawledAt DESC LIMIT ?';
  let params = [limit];
  
  if (cupType && season) {
    query = 'SELECT * FROM games WHERE cupType = ? AND season = ? ORDER BY crawledAt DESC LIMIT ?';
    params = [cupType, season, limit];
  } else if (cupType) {
    query = 'SELECT * FROM games WHERE cupType = ? ORDER BY crawledAt DESC LIMIT ?';
    params = [cupType, limit];
  } else if (season) {
    query = 'SELECT * FROM games WHERE season = ? ORDER BY crawledAt DESC LIMIT ?';
    params = [season, limit];
  }
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// Neue Route für ALLE Spiele ohne Limit
app.get('/games/all', async (req, res) => {
  const query = 'SELECT * FROM games ORDER BY crawledAt DESC';
  
  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      console.log(`📊 Returning ${rows.length} total games`);
      res.json(rows);
    }
  });
});

// Statistiken-Endpoint
app.get('/stats', async (req, res) => {
  const queries = [
    'SELECT season, cupType, COUNT(*) as count FROM games GROUP BY season, cupType ORDER BY season DESC, cupType',
    'SELECT COUNT(*) as totalGames FROM games',
    'SELECT COUNT(DISTINCT tournamentId) as totalTournaments FROM games',
    'SELECT status, COUNT(*) as count FROM games GROUP BY status'
  ];
  
  try {
    const results = await Promise.all(queries.map(query => 
      new Promise((resolve, reject) => {
        db.all(query, [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      })
    ));
    
    res.json({
      bySeason: results[0],
      totalGames: results[1][0].totalGames,
      totalTournaments: results[2][0].totalTournaments,
      byStatus: results[3]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/clear-db', (req, res) => {
  db.run('DELETE FROM games', (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ message: 'Database cleared successfully' });
    }
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Server starten
app.listen(PORT, () => {
  console.log(`🚀 Swiss Cup Crawler läuft auf http://localhost:${PORT}`);
  console.log('📊 Unterstützte Cups:');
  console.log('   🏒 Mobiliar Cup Herren/Damen Grossfeld');
  console.log('   🏑 Liga Cup Herren/Damen Kleinfeld');
  console.log('🎯 SQLite Datenbank bereit');
  console.log('📡 API-basiertes Crawling aktiv');
  console.log('📅 Unterstützte Saisons: 2022/23, 2023/24, 2024/25, 2025/26');
  console.log('🆔 Numerische Game IDs werden jetzt erfasst');
});