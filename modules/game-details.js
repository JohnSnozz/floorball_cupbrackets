// modules/game-details.js - GameDetails für sqlite3 (OHNE Benutzerabfragen)

const fetch = require('node-fetch');

class GameDetailsManager {
  constructor(db) {
    this.db = db;
    this.setupTable();
  }

  setupTable() {
    // GameDetails Tabelle erstellen (async)
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS gameDetails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numericGameId TEXT UNIQUE NOT NULL,
        eventData TEXT,
        totalEvents INTEGER DEFAULT 0,
        homeGoals INTEGER DEFAULT 0,
        awayGoals INTEGER DEFAULT 0,
        penalties INTEGER DEFAULT 0,
        lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (numericGameId) REFERENCES games(numericGameId) ON DELETE CASCADE
      )
    `;
    
    this.db.run(createTableSQL, (err) => {
      if (err) {
        console.error('❌ Fehler beim Erstellen der gameDetails Tabelle:', err);
      } else {
        console.log('✅ GameDetails Tabelle bereit');
      }
    });
  }

  async fetchGameEvents(numericGameId) {
    const url = `https://api-v2.swissunihockey.ch/api/game_events/${numericGameId}`;
    
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

  parseEventData(eventData) {
    if (!eventData?.data?.regions?.[0]?.rows) {
      return { totalEvents: 0, homeGoals: 0, awayGoals: 0, penalties: 0 };
    }

    const rows = eventData.data.regions[0].rows;
    let homeGoals = 0, awayGoals = 0, penalties = 0;

    // Tabs für Team-Namen auslesen
    const tabs = eventData.data.tabs || [];
    const homeTeam = tabs.find(t => t.link?.set_in_context?.team === 'home')?.text || '';
    const awayTeam = tabs.find(t => t.link?.set_in_context?.team === 'away')?.text || '';

    rows.forEach(row => {
      const cells = row.cells || [];
      if (cells.length < 4) return;

      const eventType = cells[1]?.text?.[0] || '';
      const team = cells[2]?.text?.[0] || '';

      // Tore zählen
      if (eventType.includes('Torschütze')) {
        if (team === homeTeam) homeGoals++;
        else if (team === awayTeam) awayGoals++;
      }

      // Strafen zählen
      if (eventType.includes('Strafe')) {
        penalties++;
      }
    });

    return {
      totalEvents: rows.length,
      homeGoals,
      awayGoals,
      penalties
    };
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

  async saveGameDetails(numericGameId, eventData) {
    const stats = this.parseEventData(eventData);
    
    const insertSQL = `
      INSERT OR REPLACE INTO gameDetails 
      (numericGameId, eventData, totalEvents, homeGoals, awayGoals, penalties, lastUpdated)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `;

    try {
      await this.runAsync(insertSQL, [
        numericGameId,
        JSON.stringify(eventData),
        stats.totalEvents,
        stats.homeGoals,
        stats.awayGoals,
        stats.penalties
      ]);
    } catch (error) {
      console.error(`❌ Fehler beim Speichern von GameID ${numericGameId}:`, error);
    }
  }

  async crawlAllGameDetails() {
    console.log('🔍 Prüfe Games Tabelle...');
    
    try {
      // Prüfe ob games Tabelle existiert
      const tableCheck = await this.queryAsync(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='games'"
      );
      
      if (!tableCheck) {
        console.log('⚠️  Games Tabelle existiert nicht - GameDetails Crawling übersprungen');
        return { success: 0, errors: 0 };
      }

      // Debug: Prüfe games Inhalt
      const totalGames = await this.queryAsync("SELECT COUNT(*) as count FROM games");
      console.log(`📊 Total Games in DB: ${totalGames.count}`);
      
      const gamesWithId = await this.queryAsync(
        "SELECT COUNT(*) as count FROM games WHERE numericGameId IS NOT NULL AND numericGameId != ''"
      );
      console.log(`🆔 Games mit numericGameId: ${gamesWithId.count}`);

      if (!gamesWithId || gamesWithId.count === 0) {
        console.log('ℹ️  Keine Games mit numericGameId gefunden - crawle erst normale Games');
        return { success: 0, errors: 0 };
      }

      // Alle Games mit numericGameId holen (ohne Freilos-Spiele)
      const gamesSQL = `
        SELECT DISTINCT numericGameId, team1, team2
        FROM games 
        WHERE numericGameId IS NOT NULL 
        AND numericGameId != ''
        AND LOWER(team1) NOT LIKE '%freilos%' 
        AND LOWER(team2) NOT LIKE '%freilos%'
        AND numericGameId NOT IN (
          SELECT numericGameId FROM gameDetails WHERE lastUpdated > datetime('now', '-1 day')
        )
      `;

      const games = await this.queryAllAsync(gamesSQL);
      
      if (!games || games.length === 0) {
        console.log('ℹ️  Alle Games bereits aktuell oder keine Games mit numericGameId vorhanden (Freilos-Spiele ausgeschlossen)');
        return { success: 0, errors: 0 };
      }

      // Debug: Zeige gefilterte Games
      console.log(`🎯 Crawle GameDetails für ${games.length} Spiele (ohne Freilos)...`);
      
      // Zusätzliche Prüfung auf Freilos in den tatsächlichen Daten
      const validGames = games.filter(game => {
        const homeTeam = (game.team1 || '').toLowerCase();
        const awayTeam = (game.team2 || '').toLowerCase();
        
        const hasFreilos = homeTeam.includes('freilos') || awayTeam.includes('freilos');
        
        if (hasFreilos) {
          console.log(`⏭️  Überspringe Freilos-Spiel: ${game.team1} vs ${game.team2} (GameID: ${game.numericGameId})`);
          return false;
        }
        
        return true;
      });

      if (validGames.length === 0) {
        console.log('ℹ️  Keine gültigen Games zum Crawlen (alle sind Freilos oder bereits aktuell)');
        return { success: 0, errors: 0 };
      }

      console.log(`✅ Verarbeite ${validGames.length} gültige Games...`);

      let success = 0, errors = 0;

      for (const game of validGames) {
        const eventData = await this.fetchGameEvents(game.numericGameId);
        
        if (eventData) {
          await this.saveGameDetails(game.numericGameId, eventData);
          success++;
          console.log(`✅ GameID ${game.numericGameId} verarbeitet (${game.team1} vs ${game.team2})`);
        } else {
          errors++;
          console.log(`❌ Fehler bei GameID ${game.numericGameId} (${game.team1} vs ${game.team2})`);
        }

        // Rate limiting - 1 Request pro Sekunde
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`📊 GameDetails Crawling abgeschlossen: ${success} erfolgreich, ${errors} Fehler`);
      return { success, errors };
      
    } catch (error) {
      console.error('❌ Fehler beim GameDetails Crawling:', error.message);
      return { success: 0, errors: 1 };
    }
  }

  async getGameDetailsStats() {
    const statsSQL = `
      SELECT 
        COUNT(*) as totalGames,
        SUM(totalEvents) as totalEvents,
        AVG(homeGoals + awayGoals) as avgGoalsPerGame,
        AVG(penalties) as avgPenaltiesPerGame
      FROM gameDetails
    `;
    
    try {
      return await this.queryAsync(statsSQL);
    } catch (error) {
      console.error('❌ Fehler beim Abrufen der Stats:', error);
      return { totalGames: 0, totalEvents: 0, avgGoalsPerGame: 0, avgPenaltiesPerGame: 0 };
    }
  }
}

module.exports = {
  GameDetailsManager,
  
  // Für Integration in server.js
  initialize: (db) => {
    return new GameDetailsManager(db);
  },

  // API Routes registrieren
  register: (app, db) => {
    const manager = new GameDetailsManager(db);

    // GameDetails für einzelnes Spiel
    app.get('/api/game-details/:gameId', async (req, res) => {
      try {
        const result = await manager.queryAsync(
          'SELECT * FROM gameDetails WHERE numericGameId = ?', 
          [req.params.gameId]
        );
        
        if (result && result.eventData) {
          result.eventData = JSON.parse(result.eventData);
        }
        
        res.json(result || { error: 'Game not found' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // GameDetails Statistiken
    app.get('/api/game-details/stats', async (req, res) => {
      try {
        const stats = await manager.getGameDetailsStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Manual crawl trigger
    app.post('/api/crawl-game-details', async (req, res) => {
      try {
        const result = await manager.crawlAllGameDetails();
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    console.log('🎯 GameDetails API-Routes registriert');
  }
};