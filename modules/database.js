// modules/database.js - Sichere PostgreSQL Konfiguration

const { Pool } = require('pg');
require('dotenv').config(); // Für .env Dateien

// Sichere Datenbank-Konfiguration aus Umgebungsvariablen
const dbConfig = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 5432,
  // Optional: SSL für Produktionsumgebung
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Connection Pool Einstellungen
  max: parseInt(process.env.DB_POOL_MAX) || 20,
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000,
};

// Validierung: Alle wichtigen Werte müssen gesetzt sein
const requiredEnvVars = ['DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DB_HOST'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ ERROR: Required environment variables are missing:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('💡 Create a .env file with all required variables');
  console.error('💡 See .env.example for reference');
  process.exit(1);
}

let pool;

function initialize() {
  console.log('🔧 Initialisiere PostgreSQL Datenbank...');
  console.log(`📍 Connecting to: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
  
  // Connection Pool erstellen
  pool = new Pool(dbConfig);
  
  // Error Handler für Pool
  pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle client:', err);
    process.exit(-1);
  });
  
  // Teste Verbindung
  testConnection();
  
  // Schema erstellen/aktualisieren
  initializeSchema();

  console.log('✅ PostgreSQL database initialized');
  return pool;
}

async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as version');
    console.log('✅ PostgreSQL connection successful');
    console.log(`📅 Server time: ${result.rows[0].current_time}`);
    console.log(`🐘 PostgreSQL version: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}`);
    client.release();
  } catch (err) {
    console.error('❌ PostgreSQL connection failed:', err.message);
    console.error('💡 Check your environment variables:');
    console.error('   - DB_PASSWORD');
    console.error('   - DB_USER (optional)');
    console.error('   - DB_NAME (optional)');
    console.error('   - DB_HOST (optional)');
    throw err;
  }
}

async function initializeSchema() {
  try {
    // Prüfe ob games Tabelle existiert
    const tableExists = await checkTableExists('games');
    
    if (tableExists) {
      console.log('🔄 Updating existing games table...');
      await addMissingColumns();
      await updateNullValues();
    } else {
      console.log('🆕 Creating new games table...');
      await createGamesTable();
    }
    
    // Erstelle Indizes
    await createIndexes();
    
  } catch (err) {
    console.error('❌ Schema initialization failed:', err.message);
    throw err;
  }
}

async function checkTableExists(tableName) {
  const query = `
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    );
  `;
  
  const result = await pool.query(query, [tableName]);
  return result.rows[0].exists;
}

async function createGamesTable() {
  const createTableQuery = `
    CREATE TABLE games (
      gameid VARCHAR(255) PRIMARY KEY,
      team1 VARCHAR(255) NOT NULL,
      team2 VARCHAR(255) NOT NULL,
      roundname VARCHAR(100),
      roundid VARCHAR(100),
      tournamentid VARCHAR(100) NOT NULL,
      tournamentname VARCHAR(255),
      season VARCHAR(20) NOT NULL,
      cuptype VARCHAR(50) NOT NULL,
      gender VARCHAR(20),
      fieldtype VARCHAR(20),
      gamedate VARCHAR(50),
      gametime VARCHAR(20),
      venue VARCHAR(255),
      status VARCHAR(50) DEFAULT 'scheduled',
      result VARCHAR(100),
      source VARCHAR(50) DEFAULT 'api',
      apiendpoint TEXT,
      link TEXT,
      hometeamscore VARCHAR(10),
      awayteamscore VARCHAR(10),
      gamelocation VARCHAR(255),
      referees TEXT,
      spectators INTEGER,
      notes TEXT,
      numericgameid INTEGER,
      bracketsortorder INTEGER,
      crawledat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  await pool.query(createTableQuery);
  console.log('✅ Games table created');
}

async function addMissingColumns() {
  const columnsToAdd = [
    { name: 'hometeamscore', type: 'VARCHAR(10)' },
    { name: 'awayteamscore', type: 'VARCHAR(10)' },
    { name: 'gamelocation', type: 'VARCHAR(255)' },
    { name: 'referees', type: 'TEXT' },
    { name: 'spectators', type: 'INTEGER' },
    { name: 'notes', type: 'TEXT' },
    { name: 'numericgameid', type: 'INTEGER' },
    { name: 'bracketsortorder', type: 'INTEGER' },
    { name: 'updatedat', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' }
  ];

  for (const column of columnsToAdd) {
    try {
      // Prüfe ob Spalte existiert (PostgreSQL speichert in Kleinbuchstaben)
      const columnExists = await checkColumnExists('games', column.name.toLowerCase());
      
      if (!columnExists) {
        const addColumnQuery = `ALTER TABLE games ADD COLUMN ${column.name} ${column.type};`;
        await pool.query(addColumnQuery);
        console.log(`✅ Added column: ${column.name}`);
      } else {
        console.log(`ℹ️  Column ${column.name} already exists`);
      }
    } catch (err) {
      // Ignoriere "already exists" Fehler
      if (err.code === '42701') {
        console.log(`ℹ️  Column ${column.name} already exists (caught duplicate error)`);
      } else {
        console.error(`❌ Error adding column ${column.name}:`, err.message);
      }
    }
  }
}

async function checkColumnExists(tableName, columnName) {
  const query = `
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = $1 AND column_name = $2
    );
  `;
  
  // PostgreSQL speichert Namen in Kleinbuchstaben
  const result = await pool.query(query, [tableName.toLowerCase(), columnName.toLowerCase()]);
  return result.rows[0].exists;
}

async function updateNullValues() {
  try {
    await pool.query(`UPDATE games SET status = 'scheduled' WHERE status IS NULL`);
    await pool.query(`UPDATE games SET source = 'api' WHERE source IS NULL`);
    console.log('✅ Updated NULL values');
  } catch (err) {
    console.error('❌ Error updating NULL values:', err.message);
  }
}

async function createIndexes() {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_season_cup ON games(season, cuptype)',
    'CREATE INDEX IF NOT EXISTS idx_tournament ON games(tournamentid)',
    'CREATE INDEX IF NOT EXISTS idx_status ON games(status)',
    'CREATE INDEX IF NOT EXISTS idx_numeric_game_id ON games(numericGameId)',
    'CREATE INDEX IF NOT EXISTS idx_bracket_sort ON games(bracketsortorder)'
  ];

  for (const indexQuery of indexes) {
    try {
      await pool.query(indexQuery);
    } catch (err) {
      console.error(`❌ Error creating index:`, err.message);
    }
  }
  
  console.log('✅ Database indexes created');
}

// Helper-Funktionen für Datenbankoperationen
async function getGameFromDB(db, gameid) {
  try {
    const result = await db.query('SELECT * FROM games WHERE gameid = $1', [gameid]);
    return result.rows[0] || null;
  } catch (err) {
    console.error(`❌ Error getting game ${gameid}:`, err.message);
    throw err;
  }
}

async function saveGameToDB(db, gamedata) {
  const insertQuery = `
    INSERT INTO games 
    ("gameid", team1, team2, "roundname", "roundid", "tournamentid", "tournamentname", 
    season, "cuptype", gender, "fieldtype", "gamedate", "gametime", venue, status, 
    result, source, "apiendpoint", link, "hometeamscore", "awayteamscore", 
    "gamelocation", referees, spectators, notes, "numericgameid", "bracketsortorder", "updatedat")
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, CURRENT_TIMESTAMP)
    ON CONFLICT ("gameid") DO NOTHING
    RETURNING "gameid";
  `;
  
  const values = [
    gamedata.gameid, gamedata.team1, gamedata.team2, gamedata.roundname,
    gamedata.roundid, gamedata.tournamentid, gamedata.tournamentname,
    gamedata.season, gamedata.cuptype, gamedata.gender, gamedata.fieldtype,
    gamedata.gamedate, gamedata.gametime, gamedata.venue, gamedata.status,
    gamedata.result, gamedata.source, gamedata.apiendpoint, gamedata.link,
    gamedata.hometeamscore || null, gamedata.awayteamscore || null,
    gamedata.gamelocation || null, gamedata.referees || null,
    gamedata.spectators || null, gamedata.notes || null,
    gamedata.numericgameid || null, gamedata.bracketsortorder || null
  ];

  try {
    const result = await db.query(insertQuery, values);
    
    if (result.rows.length > 0) {
      console.log(`✅ Successfully inserted game ${gamedata.gameid} (numeric ID: ${gamedata.numericGameId || 'N/A'})`);
      return { changes: 1, lastID: result.rows[0].gameid };
    } else {
      console.log(`🟡 Game ${gamedata.gameid} already exists (INSERT IGNORED)`);
      return { changes: 0, lastID: null };
    }
  } catch (err) {
    console.error(`❌ Database error for game ${gamedata.gameid}:`, err.message);
    throw err;
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Gracefully closing PostgreSQL pool...');
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Gracefully closing PostgreSQL pool...');
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});

module.exports = {
  initialize,
  getGameFromDB,
  saveGameToDB
};