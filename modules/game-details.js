// modules/game-details.js - GameDetails mit Saison-Management

const fetch = require('node-fetch');

class GameDetailsManager {
  constructor(db) {
    this.db = db;
    this.setupTable();
  }

  setupTable() {
    // GameDetails Tabelle für Game Info erstellen - mit season hinzugefügt
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS gameDetails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numericGameId TEXT UNIQUE NOT NULL,
        season TEXT,
        home_name TEXT,
        away_name TEXT,
        home_logo TEXT,
        away_logo TEXT,
        result TEXT,
        date TEXT,
        time TEXT,
        location TEXT,
        location_x REAL,
        location_y REAL,
        first_referee TEXT,
        second_referee TEXT,
        spectators INTEGER,
        title TEXT,
        subtitle TEXT,
        rawData TEXT,
        lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (numericGameId) REFERENCES games(numericGameId) ON DELETE CASCADE
      )
    `;
    
    this.db.run(createTableSQL, (err) => {
      if (err) {
        console.error('❌ Fehler beim Erstellen der gameDetails Tabelle:', err);
      } else {
        console.log('✅ GameDetails Tabelle bereit (Game Info API)');
        // Check if season column exists, add if not
        this.addSeasonColumnIfMissing();
      }
    });
  }

  addSeasonColumnIfMissing() {
    this.db.all("PRAGMA table_info(gameDetails)", (err, columns) => {
      if (err) {
        console.error('❌ Fehler beim Prüfen der Tabellen-Info:', err);
        return;
      }
      
      const hasSeasonColumn = columns.some(col => col.name === 'season');
      if (!hasSeasonColumn) {
        this.db.run("ALTER TABLE gameDetails ADD COLUMN season TEXT", (err) => {
          if (err) {
            console.error('❌ Fehler beim Hinzufügen der season Spalte:', err);
          } else {
            console.log('✅ Season Spalte hinzugefügt');
            // Update existing records with season from games table
            this.updateExistingSeasons();
          }
        });
      }
    });
  }

  updateExistingSeasons() {
    const updateSQL = `
      UPDATE gameDetails 
      SET season = (
        SELECT season FROM games 
        WHERE games.numericGameId = gameDetails.numericGameId 
        LIMIT 1
      )
      WHERE season IS NULL
    `;
    
    this.db.run(updateSQL, (err) => {
      if (err) {
        console.error('❌ Fehler beim Update der Seasons:', err);
      } else {
        console.log('✅ Seasons für bestehende GameDetails aktualisiert');
      }
    });
  }

  // Date-Parsing Helper
  parseDateString(dateStr) {
    if (!dateStr || dateStr.trim() === '') {
      return null;
    }

    // Hauptformat der SwissUnihockey API: DD.MM.YYYY
    const dotFormat = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (dotFormat) {
      const day = parseInt(dotFormat[1]);
      const month = parseInt(dotFormat[2]);
      const year = parseInt(dotFormat[3]);
      
      // Validierung
      if (year >= 1900 && year <= 2100 && 
          month >= 1 && month <= 12 && 
          day >= 1 && day <= 31) {
        
        // Formatiere als YYYY-MM-DD für SQLite
        return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      }
    }

    // Fallback für andere Formate
    const otherFormats = [
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // DD/MM/YYYY  
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/, // YYYY-MM-DD
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // DD-MM-YYYY
    ];

    for (let i = 0; i < otherFormats.length; i++) {
      const match = dateStr.match(otherFormats[i]);
      if (match) {
        let day, month, year;
        
        if (i === 1) { // YYYY-MM-DD
          year = parseInt(match[1]);
          month = parseInt(match[2]);
          day = parseInt(match[3]);
        } else { // DD/MM/YYYY, DD-MM-YYYY
          day = parseInt(match[1]);
          month = parseInt(match[2]);
          year = parseInt(match[3]);
        }

        if (year >= 1900 && year <= 2100 && 
            month >= 1 && month <= 12 && 
            day >= 1 && day <= 31) {
          
          return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        }
      }
    }

    console.warn(`⚠️  Ungültiges Datumsformat: "${dateStr}"`);
    return dateStr; // Original zurückgeben falls Parsing fehlschlägt
  }

  // Time-Parsing Helper
  parseTimeString(timeStr) {
    if (!timeStr || timeStr.trim() === '') {
      return null;
    }

    // Mögliche Formate: HH:MM, H:MM, HH.MM
    const timeMatch = timeStr.match(/^(\d{1,2})[:.:](\d{2})$/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
    }

    console.warn(`⚠️  Ungültiges Zeitformat: "${timeStr}"`);
    return timeStr; // Original zurückgeben
  }

  async fetchGameDetails(numericGameId) {
    const url = `https://api-v2.swissunihockey.ch/api/games/${numericGameId}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`❌ Fehler bei GameID ${numericGameId}:`, error.message);
      return null;
    }
  }

  parseGameData(gameData) {
    if (!gameData?.data?.regions?.[0]?.rows?.[0]?.cells) {
      return null;
    }

    const cells = gameData.data.regions[0].rows[0].cells;
    const title = gameData.data.title || '';
    const subtitle = gameData.data.subtitle || '';

    // Rohdaten extrahieren
    const rawDate = cells[5]?.text?.[0] || null;
    const rawTime = cells[6]?.text?.[0] || null;

    // Zellen parsen (entsprechend der Header-Reihenfolge)
    const parsed = {
      home_logo: cells[0]?.image?.url || null,
      home_name: cells[1]?.text?.[0] || null,
      away_logo: cells[2]?.image?.url || null,
      away_name: cells[3]?.text?.[0] || null,
      result: cells[4]?.text?.join(' ') || null,
      date: this.parseDateString(rawDate),
      time: this.parseTimeString(rawTime),
      location: cells[7]?.text?.[0] || null,
      location_x: cells[7]?.link?.x || null,
      location_y: cells[7]?.link?.y || null,
      first_referee: cells[8]?.text?.[0] || null,
      second_referee: cells[9]?.text?.[0] || null,
      spectators: cells[10]?.text?.[0] ? parseInt(cells[10].text[0]) : null,
      title,
      subtitle
    };

    return parsed;
  }

  // Promise-Wrapper für sqlite3
  queryAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  queryAllAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  async saveGameDetails(numericGameId, gameData, season = null) {
    const parsed = this.parseGameData(gameData);
    
    if (!parsed) {
      console.log(`⚠️  Keine verwertbaren Daten für GameID ${numericGameId}`);
      return;
    }
    
    const insertSQL = `
      INSERT OR REPLACE INTO gameDetails 
      (numericGameId, season, home_name, away_name, home_logo, away_logo, result, 
       date, time, location, location_x, location_y, first_referee, 
       second_referee, spectators, title, subtitle, rawData, lastUpdated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `;

    try {
      await this.runAsync(insertSQL, [
        numericGameId,
        season,
        parsed.home_name,
        parsed.away_name,
        parsed.home_logo,
        parsed.away_logo,
        parsed.result,
        parsed.date,
        parsed.time,
        parsed.location,
        parsed.location_x,
        parsed.location_y,
        parsed.first_referee,
        parsed.second_referee,
        parsed.spectators,
        parsed.title,
        parsed.subtitle,
        JSON.stringify(gameData)
      ]);
      
      console.log(`✅ Game Details gespeichert: ${parsed.home_name} vs ${parsed.away_name} (${numericGameId}) - Season: ${season}`);
    } catch (error) {
      console.error(`❌ Fehler beim Speichern von GameID ${numericGameId}:`, error);
    }
  }

  // Get available seasons
  async getAvailableSeasons() {
    try {
      const seasonsSQL = `
        SELECT DISTINCT season 
        FROM games 
        WHERE season IS NOT NULL 
        ORDER BY season DESC
      `;
      
      const seasons = await this.queryAllAsync(seasonsSQL);
      return seasons.map(row => row.season);
    } catch (error) {
      console.error('❌ Fehler beim Abrufen der Seasons:', error);
      return [];
    }
  }

  // Crawl für spezifische Season
  async crawlGameDetailsForSeason(season) {
    console.log(`🔍 Sammle GameIDs für Season ${season}...`);
    
    try {
      // Prüfe ob games Tabelle existiert
      const tableCheck = await this.queryAsync(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='games'"
      );
      
      if (!tableCheck) {
        console.log('⚠️  Games Tabelle existiert nicht - GameDetails Crawling übersprungen');
        return { success: 0, errors: 0 };
      }

      // Hole alle Games für spezifische Season
      const gamesSQL = `
        SELECT DISTINCT numericGameId, team1, team2, cupType, season
        FROM games 
        WHERE season = ?
        AND numericGameId IS NOT NULL 
        AND numericGameId != ''
        AND LOWER(team1) NOT LIKE '%freilos%' 
        AND LOWER(team2) NOT LIKE '%freilos%'
        ORDER BY cupType, numericGameId
      `;

      const games = await this.queryAllAsync(gamesSQL, [season]);
      
      if (!games || games.length === 0) {
        console.log(`ℹ️  Keine Games für Season ${season} gefunden`);
        return { success: 0, errors: 0 };
      }

      console.log(`🎯 Crawle Game Details für ${games.length} Spiele der Season ${season}...`);
      
      let success = 0, errors = 0;

      for (const game of games) {
        const gameData = await this.fetchGameDetails(game.numericGameId);
        
        if (gameData) {
          await this.saveGameDetails(game.numericGameId, gameData, season);
          success++;
          
          // Progress anzeigen
          if (success % 10 === 0) {
            console.log(`📊 Progress Season ${season}: ${success}/${games.length} verarbeitet`);
          }
        } else {
          errors++;
          console.log(`❌ Fehler bei GameID ${game.numericGameId} (${game.team1} vs ${game.team2})`);
        }

        // Rate limiting - 1 Request pro Sekunde
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`📊 Season ${season} Crawling abgeschlossen: ${success} erfolgreich, ${errors} Fehler`);
      return { success, errors, season };
      
    } catch (error) {
      console.error(`❌ Fehler beim Season ${season} Crawling:`, error.message);
      return { success: 0, errors: 1, season };
    }
  }

  // Delete GameDetails für spezifische Season
  async deleteGameDetailsForSeason(season) {
    try {
      const deleteSQL = 'DELETE FROM gameDetails WHERE season = ?';
      const result = await this.runAsync(deleteSQL, [season]);
      
      console.log(`🗑️ ${result.changes || 0} GameDetails für Season ${season} gelöscht`);
      return { deleted: result.changes || 0, season };
    } catch (error) {
      console.error(`❌ Fehler beim Löschen Season ${season}:`, error.message);
      return { deleted: 0, season, error: error.message };
    }
  }

  // Legacy: Crawl from all cups
  async crawlGameDetailsFromCups() {
    console.log('🔍 Sammle GameIDs aus Cup-Daten...');
    
    try {
      const tableCheck = await this.queryAsync(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='games'"
      );
      
      if (!tableCheck) {
        console.log('⚠️  Games Tabelle existiert nicht - GameDetails Crawling übersprungen');
        return { success: 0, errors: 0 };
      }

      const gamesSQL = `
        SELECT DISTINCT numericGameId, team1, team2, cupType, season
        FROM games 
        WHERE numericGameId IS NOT NULL 
        AND numericGameId != ''
        AND LOWER(team1) NOT LIKE '%freilos%' 
        AND LOWER(team2) NOT LIKE '%freilos%'
        AND numericGameId NOT IN (
          SELECT numericGameId FROM gameDetails 
          WHERE lastUpdated > datetime('now', '-1 day')
        )
        ORDER BY season DESC, cupType, numericGameId
      `;

      const games = await this.queryAllAsync(gamesSQL);
      
      if (!games || games.length === 0) {
        console.log('ℹ️  Alle Games bereits aktuell oder keine neuen Cup-Games mit numericGameId vorhanden');
        return { success: 0, errors: 0 };
      }

      console.log(`🎯 Crawle Game Details für ${games.length} Cup-Spiele...`);
      
      let success = 0, errors = 0;

      for (const game of games) {
        const gameData = await this.fetchGameDetails(game.numericGameId);
        
        if (gameData) {
          await this.saveGameDetails(game.numericGameId, gameData, game.season);
          success++;
          
          if (success % 10 === 0) {
            console.log(`📊 Progress: ${success}/${games.length} verarbeitet`);
          }
        } else {
          errors++;
          console.log(`❌ Fehler bei GameID ${game.numericGameId} (${game.team1} vs ${game.team2})`);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`📊 Game Details Crawling abgeschlossen: ${success} erfolgreich, ${errors} Fehler`);
      return { success, errors };
      
    } catch (error) {
      console.error('❌ Fehler beim Game Details Crawling:', error.message);
      return { success: 0, errors: 1 };
    }
  }

  async getGameDetailsStats() {
    const statsSQL = `
      SELECT 
        COUNT(*) as totalGames,
        COUNT(CASE WHEN result IS NOT NULL AND result != '' THEN 1 END) as gamesWithResults,
        COUNT(CASE WHEN spectators IS NOT NULL AND spectators > 0 THEN 1 END) as gamesWithSpectators,
        AVG(CASE WHEN spectators IS NOT NULL AND spectators > 0 THEN spectators END) as avgSpectators,
        COUNT(CASE WHEN first_referee IS NOT NULL AND first_referee != '' THEN 1 END) as gamesWithReferees
      FROM gameDetails
    `;
    
    try {
      return await this.queryAsync(statsSQL);
    } catch (error) {
      console.error('❌ Fehler beim Abrufen der Stats:', error);
      return { totalGames: 0, gamesWithResults: 0, gamesWithSpectators: 0, avgSpectators: 0, gamesWithReferees: 0 };
    }
  }

  async getSeasonStats() {
    const seasonStatsSQL = `
      SELECT 
        season,
        COUNT(*) as totalGames,
        COUNT(CASE WHEN result IS NOT NULL AND result != '' THEN 1 END) as gamesWithResults,
        MAX(lastUpdated) as lastUpdate
      FROM gameDetails 
      WHERE season IS NOT NULL
      GROUP BY season 
      ORDER BY season DESC
    `;
    
    try {
      return await this.queryAllAsync(seasonStatsSQL);
    } catch (error) {
      console.error('❌ Fehler beim Abrufen der Season Stats:', error);
      return [];
    }
  }
}

module.exports = {
  GameDetailsManager,
  
  initialize: (db) => {
    return new GameDetailsManager(db);
  },

  register: (app, db) => {
    const manager = new GameDetailsManager(db);

    // Game Details für einzelnes Spiel
    app.get('/api/game-details/:gameId', async (req, res) => {
      try {
        const result = await manager.queryAsync(
          'SELECT * FROM gameDetails WHERE numericGameId = ?', 
          [req.params.gameId]
        );
        
        if (result && result.rawData) {
          result.rawData = JSON.parse(result.rawData);
        }
        
        res.json(result || { error: 'Game not found' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Game Details Statistiken
    app.get('/api/game-details/stats', async (req, res) => {
      try {
        const stats = await manager.getGameDetailsStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Season Statistics
    app.get('/api/game-details/season-stats', async (req, res) => {
      try {
        const seasonStats = await manager.getSeasonStats();
        res.json(seasonStats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Available Seasons
    app.get('/api/game-details/seasons', async (req, res) => {
      try {
        const seasons = await manager.getAvailableSeasons();
        res.json(seasons);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Manual crawl trigger (alle Seasons)
    app.post('/api/crawl-game-details', async (req, res) => {
      try {
        const result = await manager.crawlGameDetailsFromCups();
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Crawl für spezifische Season
    app.post('/api/crawl-game-details/:season', async (req, res) => {
      try {
        const season = req.params.season;
        const result = await manager.crawlGameDetailsForSeason(season);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Delete GameDetails für Season
    app.delete('/api/game-details/season/:season', async (req, res) => {
      try {
        const season = req.params.season;
        const result = await manager.deleteGameDetailsForSeason(season);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Alle Game Details auflisten (mit Season-Filter)
    app.get('/api/game-details', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const season = req.query.season;
        
        let sql = `
          SELECT numericGameId, season, home_name, away_name, result, date, time, 
                 location, spectators, title, subtitle, lastUpdated
          FROM gameDetails 
        `;
        
        let params = [];
        
        if (season) {
          sql += ' WHERE season = ? ';
          params.push(season);
        }
        
        sql += ' ORDER BY lastUpdated DESC ';
        
        if (limit > 0) {
          sql += ' LIMIT ? OFFSET ? ';
          params.push(limit, offset);
        }
        
        const result = await manager.queryAllAsync(sql, params);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    console.log('🎯 GameDetails API-Routes mit Season-Management registriert');
  }
};