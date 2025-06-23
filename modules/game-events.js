// modules/game-events.js - GameEvents mit Saison-Management

const fetch = require('node-fetch');

class GameEventsManager {
  constructor(db) {
    this.db = db;
    this.setupTable();
  }

  setupTable() {
    // GameEvents Tabelle für Event-Daten erstellen - nur essenzielle Felder
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS gameEvents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        season TEXT,
        minute TEXT,
        event_type TEXT,
        team TEXT,
        player_name TEXT,
        rawData TEXT,
        lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(game_id, event_id),
        FOREIGN KEY (game_id) REFERENCES games(numericGameId) ON DELETE CASCADE
      )
    `;
    
    this.db.run(createTableSQL, (err) => {
      if (err) {
        console.error('❌ Fehler beim Erstellen der gameEvents Tabelle:', err);
      } else {
        console.log('✅ GameEvents Tabelle bereit (Game Events API)');
        this.addSeasonColumnIfMissing();
      }
    });
  }

  addSeasonColumnIfMissing() {
    this.db.all("PRAGMA table_info(gameEvents)", (err, columns) => {
      if (err) {
        console.error('❌ Fehler beim Prüfen der Tabellen-Info:', err);
        return;
      }
      
      const hasSeasonColumn = columns.some(col => col.name === 'season');
      if (!hasSeasonColumn) {
        this.db.run("ALTER TABLE gameEvents ADD COLUMN season TEXT", (err) => {
          if (err) {
            console.error('❌ Fehler beim Hinzufügen der season Spalte:', err);
          } else {
            console.log('✅ Season Spalte zu gameEvents hinzugefügt');
            this.updateExistingSeasons();
          }
        });
      }
    });
  }

  updateExistingSeasons() {
    const updateSQL = `
      UPDATE gameEvents 
      SET season = (
        SELECT season FROM games 
        WHERE games.numericGameId = gameEvents.game_id 
        LIMIT 1
      )
      WHERE season IS NULL
    `;
    
    this.db.run(updateSQL, (err) => {
      if (err) {
        console.error('❌ Fehler beim Update der Seasons:', err);
      } else {
        console.log('✅ Seasons für bestehende GameEvents aktualisiert');
      }
    });
  }

  async fetchGameEvents(gameId) {
    const url = `https://api-v2.swissunihockey.ch/api/game_events/${gameId}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`❌ Fehler bei GameID ${gameId}:`, error.message);
      return null;
    }
  }

  parseGameEventsData(gameData, gameId) {
    if (!gameData?.data?.regions?.[0]?.rows) {
      return [];
    }

    const rows = gameData.data.regions[0].rows;
    const events = [];
    
    rows.forEach((row, index) => {
      if (!row.cells || row.cells.length < 4) return;
      
      const cells = row.cells;
      
      // Event-ID generieren (gameId + index)
      const eventId = `${gameId}_${index.toString().padStart(3, '0')}`;
      
      const event = {
        event_id: eventId,
        minute: cells[0]?.text?.[0] || null,
        event_type: cells[1]?.text?.[0] || null,
        team: cells[2]?.text?.[0] || null,
        player_name: cells[3]?.text?.[0] || null
      };
      
      // Nur Events mit relevanten Daten hinzufügen
      if (event.event_type) {
        events.push(event);
      }
    });

    return events;
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

  async saveGameEvents(gameId, gameData, season = null) {
    const events = this.parseGameEventsData(gameData, gameId);
    
    if (!events || events.length === 0) {
      console.log(`⚠️  Keine Events für GameID ${gameId} gefunden`);
      return 0;
    }
    
    const insertSQL = `
      INSERT OR REPLACE INTO gameEvents 
      (game_id, event_id, season, minute, event_type, team, player_name, 
       rawData, lastUpdated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `;

    let saved = 0;

    try {
      for (const event of events) {
        await this.runAsync(insertSQL, [
          gameId,
          event.event_id,
          season,
          event.minute,
          event.event_type,
          event.team,
          event.player_name,
          JSON.stringify(gameData)
        ]);
        saved++;
      }
      
      console.log(`✅ ${saved} Events gespeichert für GameID ${gameId} - Season: ${season}`);
      return saved;
    } catch (error) {
      console.error(`❌ Fehler beim Speichern von Events für GameID ${gameId}:`, error);
      return 0;
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
  async crawlGameEventsForSeason(season) {
    console.log(`🔍 Sammle GameEvents für Season ${season}...`);
    
    try {
      // Prüfe ob games Tabelle existiert
      const tableCheck = await this.queryAsync(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='games'"
      );
      
      if (!tableCheck) {
        console.log('⚠️  Games Tabelle existiert nicht - GameEvents Crawling übersprungen');
        return { success: 0, errors: 0, totalEvents: 0 };
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
        return { success: 0, errors: 0, totalEvents: 0 };
      }

      console.log(`🎯 Crawle GameEvents für ${games.length} Spiele der Season ${season}...`);
      
      let success = 0, errors = 0, totalEvents = 0;

      for (const game of games) {
        const gameData = await this.fetchGameEvents(game.numericGameId);
        
        if (gameData) {
          const eventCount = await this.saveGameEvents(game.numericGameId, gameData, season);
          if (eventCount > 0) {
            success++;
            totalEvents += eventCount;
          }
          
          // Progress anzeigen
          if (success % 10 === 0) {
            console.log(`📊 Progress Season ${season}: ${success}/${games.length} verarbeitet, ${totalEvents} Events`);
          }
        } else {
          errors++;
          console.log(`❌ Fehler bei GameID ${game.numericGameId} (${game.team1} vs ${game.team2})`);
        }

        // Rate limiting - 1 Request pro Sekunde
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`📊 Season ${season} Events Crawling abgeschlossen: ${success} Games erfolgreich, ${errors} Fehler, ${totalEvents} Events total`);
      return { success, errors, totalEvents, season };
      
    } catch (error) {
      console.error(`❌ Fehler beim Season ${season} Events Crawling:`, error.message);
      return { success: 0, errors: 1, totalEvents: 0, season };
    }
  }

  // Delete GameEvents für spezifische Season
  async deleteGameEventsForSeason(season) {
    try {
      const deleteSQL = 'DELETE FROM gameEvents WHERE season = ?';
      const result = await this.runAsync(deleteSQL, [season]);
      
      console.log(`🗑️ ${result.changes || 0} GameEvents für Season ${season} gelöscht`);
      return { deleted: result.changes || 0, season };
    } catch (error) {
      console.error(`❌ Fehler beim Löschen Season ${season}:`, error.message);
      return { deleted: 0, season, error: error.message };
    }
  }

  // Legacy: Crawl from all cups
  async crawlGameEventsFromCups() {
    console.log('🔍 Sammle GameEvents aus Cup-Daten...');
    
    try {
      const tableCheck = await this.queryAsync(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='games'"
      );
      
      if (!tableCheck) {
        console.log('⚠️  Games Tabelle existiert nicht - GameEvents Crawling übersprungen');
        return { success: 0, errors: 0, totalEvents: 0 };
      }

      const gamesSQL = `
        SELECT DISTINCT numericGameId, team1, team2, cupType, season
        FROM games 
        WHERE numericGameId IS NOT NULL 
        AND numericGameId != ''
        AND LOWER(team1) NOT LIKE '%freilos%' 
        AND LOWER(team2) NOT LIKE '%freilos%'
        AND numericGameId NOT IN (
          SELECT DISTINCT game_id FROM gameEvents 
          WHERE lastUpdated > datetime('now', '-1 day')
        )
        ORDER BY season DESC, cupType, numericGameId
      `;

      const games = await this.queryAllAsync(gamesSQL);
      
      if (!games || games.length === 0) {
        console.log('ℹ️  Alle Games bereits aktuell oder keine neuen Cup-Games mit numericGameId vorhanden');
        return { success: 0, errors: 0, totalEvents: 0 };
      }

      console.log(`🎯 Crawle GameEvents für ${games.length} Cup-Spiele...`);
      
      let success = 0, errors = 0, totalEvents = 0;

      for (const game of games) {
        const gameData = await this.fetchGameEvents(game.numericGameId);
        
        if (gameData) {
          const eventCount = await this.saveGameEvents(game.numericGameId, gameData, game.season);
          if (eventCount > 0) {
            success++;
            totalEvents += eventCount;
          }
          
          if (success % 10 === 0) {
            console.log(`📊 Progress: ${success}/${games.length} verarbeitet, ${totalEvents} Events`);
          }
        } else {
          errors++;
          console.log(`❌ Fehler bei GameID ${game.numericGameId} (${game.team1} vs ${game.team2})`);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`📊 GameEvents Crawling abgeschlossen: ${success} Games erfolgreich, ${errors} Fehler, ${totalEvents} Events total`);
      return { success, errors, totalEvents };
      
    } catch (error) {
      console.error('❌ Fehler beim GameEvents Crawling:', error.message);
      return { success: 0, errors: 1, totalEvents: 0 };
    }
  }

  async getGameEventsStats() {
    const statsSQL = `
      SELECT 
        COUNT(*) as totalEvents,
        COUNT(DISTINCT game_id) as totalGames,
        COUNT(CASE WHEN event_type LIKE '%Torschütze%' THEN 1 END) as goals,
        COUNT(CASE WHEN event_type LIKE '%Strafe%' THEN 1 END) as penalties,
        COUNT(CASE WHEN event_type = 'Bester Spieler' THEN 1 END) as bestPlayers,
        COUNT(DISTINCT season) as seasons
      FROM gameEvents
    `;
    
    try {
      return await this.queryAsync(statsSQL);
    } catch (error) {
      console.error('❌ Fehler beim Abrufen der Stats:', error);
      return { totalEvents: 0, totalGames: 0, goals: 0, penalties: 0, bestPlayers: 0, seasons: 0 };
    }
  }

  async getSeasonStats() {
    const seasonStatsSQL = `
      SELECT 
        season,
        COUNT(*) as totalEvents,
        COUNT(DISTINCT game_id) as totalGames,
        COUNT(CASE WHEN event_type LIKE '%Torschütze%' THEN 1 END) as goals,
        MAX(lastUpdated) as lastUpdate
      FROM gameEvents 
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
  GameEventsManager,
  
  initialize: (db) => {
    return new GameEventsManager(db);
  },

  register: (app, db) => {
    const manager = new GameEventsManager(db);

    // Game Events für einzelnes Spiel
    app.get('/api/game-events/:gameId', async (req, res) => {
      try {
        const result = await manager.queryAllAsync(
          'SELECT * FROM gameEvents WHERE game_id = ? ORDER BY id', 
          [req.params.gameId]
        );
        
        res.json(result || []);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Game Events Statistiken
    app.get('/api/game-events/stats', async (req, res) => {
      try {
        const stats = await manager.getGameEventsStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Season Statistics
    app.get('/api/game-events/season-stats', async (req, res) => {
      try {
        const seasonStats = await manager.getSeasonStats();
        res.json(seasonStats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Available Seasons
    app.get('/api/game-events/seasons', async (req, res) => {
      try {
        const seasons = await manager.getAvailableSeasons();
        res.json(seasons);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Manual crawl trigger (alle Seasons)
    app.post('/api/crawl-game-events', async (req, res) => {
      try {
        const result = await manager.crawlGameEventsFromCups();
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Crawl für spezifische Season
    app.post('/api/crawl-game-events/:season', async (req, res) => {
      try {
        const season = req.params.season;
        const result = await manager.crawlGameEventsForSeason(season);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Delete GameEvents für Season
    app.delete('/api/game-events/season/:season', async (req, res) => {
      try {
        const season = req.params.season;
        const result = await manager.deleteGameEventsForSeason(season);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Alle Game Events auflisten (mit Season-Filter)
    app.get('/api/game-events', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const season = req.query.season;
        const gameId = req.query.game_id;
        
        let sql = `
          SELECT game_id, event_id, season, minute, event_type, team, 
                 player_name, lastUpdated
          FROM gameEvents 
        `;
        
        let params = [];
        let conditions = [];
        
        if (season) {
          conditions.push('season = ?');
          params.push(season);
        }
        
        if (gameId) {
          conditions.push('game_id = ?');
          params.push(gameId);
        }
        
        if (conditions.length > 0) {
          sql += ' WHERE ' + conditions.join(' AND ');
        }
        
        sql += ' ORDER BY game_id, id ';
        
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

    console.log('🎯 GameEvents API-Routes mit Season-Management registriert');
  }
};