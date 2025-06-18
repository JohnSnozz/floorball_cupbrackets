// modules/database.js - Datenbank-Setup und -konfiguration

const sqlite3 = require('sqlite3').verbose();

function initialize() {
  console.log('🔧 Initialisiere SQLite Datenbank...');
  
  const db = new sqlite3.Database('cup_games.db');

  // Datenbankschema erstellen/aktualisieren
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
          'bracketSortOrder INTEGER',
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
            bracketSortOrder INTEGER,
            crawledAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
      }
    });
    
    // Indizes für bessere Performance (mit IF NOT EXISTS)
    setTimeout(() => {
      db.run(`CREATE INDEX IF NOT EXISTS idx_season_cup ON games(season, cupType)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_tournament ON games(tournamentId)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_status ON games(status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_numeric_game_id ON games(numericGameId)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_bracket_sort ON games(bracketSortOrder)`);
    }, 1000);
  });

  console.log('✅ SQLite database initialized');
  return db;
}

// Helper-Funktionen für Datenbankoperationen
async function getGameFromDB(db, gameId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM games WHERE gameId = ?', [gameId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function saveGameToDB(db, gameData) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO games 
      (gameId, team1, team2, roundName, roundId, tournamentId, tournamentName, 
       season, cupType, gender, fieldType, gameDate, gameTime, venue, status, 
       result, source, apiEndpoint, link, homeTeamScore, awayTeamScore, 
       gameLocation, referees, spectators, notes, numericGameId, bracketSortOrder, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
      gameData.numericGameId || null, gameData.bracketSortOrder || null
    ], function(err) {
      if (err) {
        console.error(`❌ Database error for game ${gameData.gameId}:`, err.message);
        reject(err);
      } else {
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

module.exports = {
  initialize,
  getGameFromDB,
  saveGameToDB
};