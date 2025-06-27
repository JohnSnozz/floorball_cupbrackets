// modules/game-events.js - GameEvents mit Saison-Management (PostgreSQL)

class GameEventsManager {
  constructor(pool) {
    this.pool = pool;
    this.setupTable();
  }

  async setupTable() {
    try {
      // GameEvents Tabelle für Event-Daten erstellen - lowercase für PostgreSQL
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS gameevents (
          id SERIAL PRIMARY KEY,
          game_id VARCHAR(50) NOT NULL,
          event_id VARCHAR(100) NOT NULL,
          season VARCHAR(20),
          minute VARCHAR(10),
          event_type VARCHAR(100),
          team VARCHAR(255),
          player_name VARCHAR(255),
          rawdata TEXT,
          lastupdated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(game_id, event_id)
        )
      `;
      
      await this.pool.query(createTableSQL);
      console.log('✅ GameEvents Tabelle bereit (Game Events API)');
    } catch (err) {
      console.error('❌ Fehler beim Erstellen der gameEvents Tabelle:', err);
    }
  }

  async checkTableExists(tableName) {
    try {
      const query = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `;
      
      const result = await this.pool.query(query, [tableName.toLowerCase()]);
      return result.rows[0].exists;
    } catch (err) {
      console.error('❌ Fehler beim Prüfen der Tabelle:', err);
      return false;
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
        UPDATE gameevents 
        SET season = (
          SELECT season FROM games 
          WHERE games.numericgameid::VARCHAR = gameevents.game_id 
          LIMIT 1
        )
        WHERE season IS NULL
      `;
      
      await this.pool.query(updateSQL);
      console.log('✅ Seasons für bestehende GameEvents aktualisiert');
    } catch (err) {
      console.error('❌ Fehler beim Update der Seasons:', err);
    }
  }

  async fetchGameEvents(gameid) {
    const url = `https://api-v2.swissunihockey.ch/api/game_events/${gameid}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`❌ Fehler bei gameid ${gameid}:`, error.message);
      return null;
    }
  }

  parseGameEventsData(gameData, gameid) {
    if (!gameData?.data?.regions?.[0]?.rows) {
      return [];
    }

    const rows = gameData.data.regions[0].rows;
    const events = [];
    
    rows.forEach((row, index) => {
      if (!row.cells || row.cells.length < 4) return;
      
      const cells = row.cells;
      
      // Event-ID generieren (gameid + index)
      const eventId = `${gameid}_${index.toString().padStart(3, '0')}`;
      
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

  async saveGameEvents(gameid, gameData, season = null) {
    const events = this.parseGameEventsData(gameData, gameid);
    
    if (!events || events.length === 0) {
      console.log(`⚠️  Keine Events für gameid ${gameid} gefunden`);
      return 0;
    }
    
    const insertSQL = `
      INSERT INTO gameevents 
      (game_id, event_id, season, minute, event_type, team, player_name, 
       rawdata, lastupdated)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      ON CONFLICT (game_id, event_id) DO UPDATE SET
        season = EXCLUDED.season,
        minute = EXCLUDED.minute,
        event_type = EXCLUDED.event_type,
        team = EXCLUDED.team,
        player_name = EXCLUDED.player_name,
        rawdata = EXCLUDED.rawdata,
        lastupdated = CURRENT_TIMESTAMP
    `;

    let saved = 0;

    try {
      for (const event of events) {
        await this.pool.query(insertSQL, [
          gameid,
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
      
      console.log(`✅ ${saved} Events gespeichert für gameid ${gameid} - Season: ${season}`);
      return saved;
    } catch (error) {
      console.error(`❌ Fehler beim Speichern von Events für gameid ${gameid}:`, error);
      return 0;
    }
  }

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

  async crawlGameEventsForSeason(season) {
    console.log(`🔍 Sammle GameEvents für Season ${season}...`);
    
    try {
      const tableCheck = await this.checkTableExists('games');
      
      if (!tableCheck) {
        console.log('⚠️  Games Tabelle existiert nicht - GameEvents Crawling übersprungen');
        return { success: 0, errors: 0, totalEvents: 0 };
      }

      const gamesSQL = `
        SELECT DISTINCT numericgameid, team1, team2, cuptype, season
        FROM games 
        WHERE season = $1
        AND numericgameid IS NOT NULL 
        AND numericgameid > 0
        AND LOWER(team1) NOT LIKE '%freilos%' 
        AND LOWER(team2) NOT LIKE '%freilos%'
        ORDER BY cuptype, numericgameid
      `;

      const gamesResult = await this.pool.query(gamesSQL, [season]);
      const games = gamesResult.rows;
      
      if (!games || games.length === 0) {
        console.log(`ℹ️  Keine Games für Season ${season} gefunden`);
        return { success: 0, errors: 0, totalEvents: 0 };
      }

      console.log(`🎯 Crawle GameEvents für ${games.length} Spiele der Season ${season}...`);
      
      let success = 0, errors = 0, totalEvents = 0;

      for (const game of games) {
        const gameData = await this.fetchGameEvents(game.numericgameid);
        
        if (gameData) {
          const eventCount = await this.saveGameEvents(game.numericgameid, gameData, season);
          if (eventCount > 0) {
            success++;
            totalEvents += eventCount;
          }
          
          if (success % 10 === 0) {
            console.log(`📊 Progress Season ${season}: ${success}/${games.length} verarbeitet, ${totalEvents} Events`);
          }
        } else {
          errors++;
          console.log(`❌ Fehler bei gameid ${game.numericgameid} (${game.team1} vs ${game.team2})`);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`📊 Season ${season} Events Crawling abgeschlossen: ${success} Games erfolgreich, ${errors} Fehler, ${totalEvents} Events total`);
      return { success, errors, totalEvents, season };
      
    } catch (error) {
      console.error(`❌ Fehler beim Season ${season} Events Crawling:`, error.message);
      return { success: 0, errors: 1, totalEvents: 0, season };
    }
  }

  async deleteGameEventsForSeason(season) {
    try {
      const deleteSQL = 'DELETE FROM gameevents WHERE season = $1';
      const result = await this.pool.query(deleteSQL, [season]);
      
      console.log(`🗑️ ${result.rowCount || 0} GameEvents für Season ${season} gelöscht`);
      return { deleted: result.rowCount || 0, season };
    } catch (error) {
      console.error(`❌ Fehler beim Löschen Season ${season}:`, error.message);
      return { deleted: 0, season, error: error.message };
    }
  }

  async crawlGameEventsFromCups() {
    console.log('🔍 Sammle GameEvents aus Cup-Daten...');
    
    try {
      const tableCheck = await this.checkTableExists('games');
      
      if (!tableCheck) {
        console.log('⚠️  Games Tabelle existiert nicht - GameEvents Crawling übersprungen');
        return { success: 0, errors: 0, totalEvents: 0 };
      }

      const gamesSQL = `
        SELECT DISTINCT numericgameid, team1, team2, cuptype, season
        FROM games 
        WHERE numericgameid IS NOT NULL 
        AND numericgameid > 0
        AND LOWER(team1) NOT LIKE '%freilos%' 
        AND LOWER(team2) NOT LIKE '%freilos%'
        AND numericgameid NOT IN (
          SELECT DISTINCT game_id FROM gameevents 
          WHERE lastupdated > CURRENT_TIMESTAMP - INTERVAL '1 day'
        )
        ORDER BY season DESC, cuptype, numericgameid
      `;

      const gamesResult = await this.pool.query(gamesSQL);
      const games = gamesResult.rows;
      
      if (!games || games.length === 0) {
        console.log('ℹ️  Alle Games bereits aktuell oder keine neuen Cup-Games mit numericGameId vorhanden');
        return { success: 0, errors: 0, totalEvents: 0 };
      }

      console.log(`🎯 Crawle GameEvents für ${games.length} Cup-Spiele...`);
      
      let success = 0, errors = 0, totalEvents = 0;

      for (const game of games) {
        const gameData = await this.fetchGameEvents(game.numericgameid);
        
        if (gameData) {
          const eventCount = await this.saveGameEvents(game.numericgameid, gameData, game.season);
          if (eventCount > 0) {
            success++;
            totalEvents += eventCount;
          }
          
          if (success % 10 === 0) {
            console.log(`📊 Progress: ${success}/${games.length} verarbeitet, ${totalEvents} Events`);
          }
        } else {
          errors++;
          console.log(`❌ Fehler bei gameid ${game.numericgameid} (${game.team1} vs ${game.team2})`);
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
        COUNT(*) as totalevents,
        COUNT(DISTINCT game_id) as totalgames,
        COUNT(CASE WHEN event_type LIKE '%Torschütze%' THEN 1 END) as goals,
        COUNT(CASE WHEN event_type LIKE '%Strafe%' THEN 1 END) as penalties,
        COUNT(CASE WHEN event_type = 'Bester Spieler' THEN 1 END) as bestplayers,
        COUNT(DISTINCT season) as seasons
      FROM gameevents
    `;
    
    try {
      const result = await this.pool.query(statsSQL);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Fehler beim Abrufen der Stats:', error);
      return { totalevents: 0, totalgames: 0, goals: 0, penalties: 0, bestplayers: 0, seasons: 0 };
    }
  }

  async getSeasonStats() {
    const seasonStatsSQL = `
      SELECT 
        season,
        COUNT(*) as totalevents,
        COUNT(DISTINCT game_id) as totalgames,
        COUNT(CASE WHEN event_type LIKE '%Torschütze%' THEN 1 END) as goals,
        MAX(lastupdated) as lastupdate
      FROM gameevents 
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
  GameEventsManager,
  
  initialize: (pool) => {
    return new GameEventsManager(pool);
  },

  register: (app, pool) => {
    const manager = new GameEventsManager(pool);

    // Game Events für einzelnes Spiel
    app.get('/api/game-events/:gameid', async (req, res) => {
      try {
        const result = await manager.pool.query(
          'SELECT * FROM gameevents WHERE game_id = $1 ORDER BY id', 
          [req.params.gameid]
        );
        
        res.json(result.rows || []);
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
        const gameid = req.query.game_id;
        
        let sql = `
          SELECT game_id, event_id, season, minute, event_type, team, 
                 player_name, lastupdated
          FROM gameevents 
        `;
        
        let params = [];
        let conditions = [];
        
        if (season) {
          conditions.push(`season = $${params.length + 1}`);
          params.push(season);
        }
        
        if (gameid) {
          conditions.push(`game_id = $${params.length + 1}`);
          params.push(gameid);
        }
        
        if (conditions.length > 0) {
          sql += ' WHERE ' + conditions.join(' AND ');
        }
        
        sql += ' ORDER BY game_id, id ';
        
        if (limit > 0) {
          sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2} `;
          params.push(limit, offset);
        }
        
        const result = await manager.pool.query(sql, params);
        res.json(result.rows);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    console.log('🎯 GameEvents API-Routes mit Season-Management registriert');
  }
};