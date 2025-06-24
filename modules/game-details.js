// modules/game-details.js - GameDetails mit Saison-Management (PostgreSQL)

const fetch = require('node-fetch');

class GameDetailsManager {
  constructor(pool) {
    this.pool = pool;
    this.setupTable();
  }

  async setupTable() {
    try {
      // GameDetails Tabelle für Game Info erstellen - mit season hinzugefügt
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS gameDetails (
          id SERIAL PRIMARY KEY,
          numericGameId VARCHAR(50) UNIQUE NOT NULL,
          season VARCHAR(20),
          home_name VARCHAR(255),
          away_name VARCHAR(255),
          home_logo TEXT,
          away_logo TEXT,
          result VARCHAR(100),
          date VARCHAR(50),
          time VARCHAR(20),
          location VARCHAR(255),
          location_x REAL,
          location_y REAL,
          first_referee VARCHAR(255),
          second_referee VARCHAR(255),
          spectators INTEGER,
          title TEXT,
          subtitle TEXT,
          rawData TEXT,
          lastUpdated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      await this.pool.query(createTableSQL);
      console.log('✅ GameDetails Tabelle bereit (Game Info API)');
      
      // Check if season column exists, add if not
      await this.addSeasonColumnIfMissing();
    } catch (err) {
      console.error('❌ Fehler beim Erstellen der gameDetails Tabelle:', err);
    }
  }

  async addSeasonColumnIfMissing() {
    try {
      // Prüfe ob season Spalte existiert
      const columnExists = await this.checkColumnExists('gamedetails', 'season');
      console.log(`🔍 Debug: Season column exists in gameDetails: ${columnExists}`);
      
      if (!columnExists) {
        await this.pool.query("ALTER TABLE gameDetails ADD COLUMN season VARCHAR(20)");
        console.log('✅ Season Spalte hinzugefügt');
        // Update existing records with season from games table
        await this.updateExistingSeasons();
      } else {
        console.log('ℹ️  Season Spalte bereits vorhanden in gameDetails');
      }
    } catch (err) {
      // Ignoriere "already exists" Fehler
      if (err.code === '42701') {
        console.log('ℹ️  Season Spalte bereits vorhanden in gameDetails (caught duplicate error)');
      } else {
        console.error('❌ Fehler beim Prüfen/Hinzufügen der season Spalte:', err);
      }
    }
  }

  async checkColumnExists(tableName, columnName) {
    try {
      const query = `
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = $2
        );
      `;
      
      // PostgreSQL speichert Namen in Kleinbuchstaben
      const result = await this.pool.query(query, [tableName.toLowerCase(), columnName.toLowerCase()]);
      return result.rows[0].exists;
    } catch (err) {
      console.error('❌ Fehler beim Prüfen der Spalte:', err);
      return false;
    }
  }

  async updateExistingSeasons() {
    try {
      const updateSQL = `
        UPDATE gameDetails 
        SET season = (
          SELECT season FROM games 
          WHERE games.numericGameId::VARCHAR = gameDetails.numericGameId 
          LIMIT 1
        )
        WHERE season IS NULL
      `;
      
      await this.pool.query(updateSQL);
      console.log('✅ Seasons für bestehende GameDetails aktualisiert');
    } catch (err) {
      console.error('❌ Fehler beim Update der Seasons:', err);
    }
  }

  // Date-Parsing Helper
  parseDateString(dateStr) {
    if (!dateStr || dateStr.trim() === '') {
      return null;
    }

    // Neue Logik für "heute" und "morgen"
    const today = new Date();
    const lowerDateStr = dateStr.toLowerCase().trim();
    
    if (lowerDateStr === 'heute') {
      const year = today.getFullYear();
      const month = (today.getMonth() + 1).toString().padStart(2, '0');
      const day = today.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    if (lowerDateStr === 'morgen') {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const year = tomorrow.getFullYear();
      const month = (tomorrow.getMonth() + 1).toString().padStart(2, '0');
      const day = tomorrow.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
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
        
        // Formatiere als YYYY-MM-DD für PostgreSQL
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

  async saveGameDetails(numericGameId, gameData, season = null) {
    const parsed = this.parseGameData(gameData);
    
    if (!parsed) {
      console.log(`⚠️  Keine verwertbaren Daten für GameID ${numericGameId}`);
      return;
    }
    
    const insertSQL = `
      INSERT INTO gameDetails 
      (numericGameId, season, home_name, away_name, home_logo, away_logo, result, 
       date, time, location, location_x, location_y, first_referee, 
       second_referee, spectators, title, subtitle, rawData, lastUpdated)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, CURRENT_TIMESTAMP)
      ON CONFLICT (numericGameId) DO UPDATE SET
        season = EXCLUDED.season,
        home_name = EXCLUDED.home_name,
        away_name = EXCLUDED.away_name,
        home_logo = EXCLUDED.home_logo,
        away_logo = EXCLUDED.away_logo,
        result = EXCLUDED.result,
        date = EXCLUDED.date,
        time = EXCLUDED.time,
        location = EXCLUDED.location,
        location_x = EXCLUDED.location_x,
        location_y = EXCLUDED.location_y,
        first_referee = EXCLUDED.first_referee,
        second_referee = EXCLUDED.second_referee,
        spectators = EXCLUDED.spectators,
        title = EXCLUDED.title,
        subtitle = EXCLUDED.subtitle,
        rawData = EXCLUDED.rawData,
        lastUpdated = CURRENT_TIMESTAMP
    `;

    try {
      await this.pool.query(insertSQL, [
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
      
      const result = await this.pool.query(seasonsSQL);
      return result.rows.map(row => row.season);
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
      const tableCheck = await this.checkTableExists('games');
      
      if (!tableCheck) {
        console.log('⚠️  Games Tabelle existiert nicht - GameDetails Crawling übersprungen');
        return { success: 0, errors: 0 };
      }

      // Hole alle Games für spezifische Season
      const gamesSQL = `
        SELECT DISTINCT numericGameId, team1, team2, cupType, season
        FROM games 
        WHERE season = $1
        AND numericGameId IS NOT NULL 
        AND numericGameId != ''
        AND LOWER(team1) NOT LIKE '%freilos%' 
        AND LOWER(team2) NOT LIKE '%freilos%'
        ORDER BY cupType, numericGameId
      `;

      const gamesResult = await this.pool.query(gamesSQL, [season]);
      const games = gamesResult.rows;
      
      if (!games || games.length === 0) {
        console.log(`ℹ️  Keine Games für Season ${season} gefunden`);
        return { success: 0, errors: 0 };
      }

      console.log(`🎯 Crawle Game Details für ${games.length} Spiele der Season ${season}...`);
      
      let success = 0, errors = 0;

      for (const game of games) {
        const gameData = await this.fetchGameDetails(game.numericgameid);
        
        if (gameData) {
          await this.saveGameDetails(game.numericgameid, gameData, season);
          success++;
          
          // Progress anzeigen
          if (success % 10 === 0) {
            console.log(`📊 Progress Season ${season}: ${success}/${games.length} verarbeitet`);
          }
        } else {
          errors++;
          console.log(`❌ Fehler bei GameID ${game.numericgameid} (${game.team1} vs ${game.team2})`);
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
      const deleteSQL = 'DELETE FROM gameDetails WHERE season = $1';
      const result = await this.pool.query(deleteSQL, [season]);
      
      console.log(`🗑️ ${result.rowCount || 0} GameDetails für Season ${season} gelöscht`);
      return { deleted: result.rowCount || 0, season };
    } catch (error) {
      console.error(`❌ Fehler beim Löschen Season ${season}:`, error.message);
      return { deleted: 0, season, error: error.message };
    }
  }

  // Legacy: Crawl from all cups
  async crawlGameDetailsFromCups() {
    console.log('🔍 Sammle GameIDs aus Cup-Daten...');
    
    try {
      const tableCheck = await this.checkTableExists('games');
      
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
          WHERE lastUpdated > CURRENT_TIMESTAMP - INTERVAL '1 day'
        )
        ORDER BY season DESC, cupType, numericGameId
      `;

      const gamesResult = await this.pool.query(gamesSQL);
      const games = gamesResult.rows;
      
      if (!games || games.length === 0) {
        console.log('ℹ️  Alle Games bereits aktuell oder keine neuen Cup-Games mit numericGameId vorhanden');
        return { success: 0, errors: 0 };
      }

      console.log(`🎯 Crawle Game Details für ${games.length} Cup-Spiele...`);
      
      let success = 0, errors = 0;

      for (const game of games) {
        const gameData = await this.fetchGameDetails(game.numericgameid);
        
        if (gameData) {
          await this.saveGameDetails(game.numericgameid, gameData, game.season);
          success++;
          
          if (success % 10 === 0) {
            console.log(`📊 Progress: ${success}/${games.length} verarbeitet`);
          }
        } else {
          errors++;
          console.log(`❌ Fehler bei GameID ${game.numericgameid} (${game.team1} vs ${game.team2})`);
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
      const result = await this.pool.query(statsSQL);
      return result.rows[0];
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
      const result = await this.pool.query(seasonStatsSQL);
      return result.rows;
    } catch (error) {
      console.error('❌ Fehler beim Abrufen der Season Stats:', error);
      return [];
    }
  }
}

module.exports = {
  GameDetailsManager,
  
  initialize: (pool) => {
    return new GameDetailsManager(pool);
  },

  register: (app, pool) => {
    const manager = new GameDetailsManager(pool);

    // Game Details für einzelnes Spiel
    app.get('/api/game-details/:gameId', async (req, res) => {
      try {
        const result = await manager.pool.query(
          'SELECT * FROM gameDetails WHERE numericGameId = $1', 
          [req.params.gameId]
        );
        
        let gameDetail = result.rows[0] || { error: 'Game not found' };
        
        if (gameDetail && gameDetail.rawdata) {
          gameDetail.rawData = JSON.parse(gameDetail.rawdata);
        }
        
        res.json(gameDetail);
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
          sql += ' WHERE season = $1 ';
          params.push(season);
        }
        
        sql += ' ORDER BY lastUpdated DESC ';
        
        if (limit > 0) {
          if (season) {
            sql += ' LIMIT $2 OFFSET $3 ';
            params.push(limit, offset);
          } else {
            sql += ' LIMIT $1 OFFSET $2 ';
            params.push(limit, offset);
          }
        }
        
        const result = await manager.pool.query(sql, params);
        res.json(result.rows);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    console.log('🎯 GameDetails API-Routes mit Season-Management registriert');
  }
};