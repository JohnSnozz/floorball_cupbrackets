// modules/api-routes.js - API Routes für Frontend (PostgreSQL)

// Cup-Konfigurationen (aus cup-routes.js übernommen)
const CUP_CONFIGS = {
  herren_grossfeld: {
    name: 'Grossfeld Herren',
    gender: 'herren',
    field_type: 'grossfeld'
  },
  damen_grossfeld: {
    name: 'Grossfeld Damen',
    gender: 'damen',
    field_type: 'grossfeld'
  },
  herren_kleinfeld: {
    name: 'Kleinfeld Herren',
    gender: 'herren',
    field_type: 'kleinfeld'
  },
  damen_kleinfeld: {
    name: 'Kleinfeld Damen',
    gender: 'damen',
    field_type: 'kleinfeld'
  }
};

function register(app, db) {
  console.log('🔧 Registriere API-Routen für Frontend...');

  // GET /api/seasons - Verfügbare Seasons aus DB
  app.get('/api/seasons', async (req, res) => {
    try {
      console.log('📅 API call: Get available seasons');
      
      const query = `
        SELECT DISTINCT season 
        FROM games 
        WHERE season IS NOT NULL AND season != ''
        ORDER BY season DESC
      `;
      
      const result = await db.query(query);
      const seasons = result.rows.map(row => row.season);
      console.log(`✅ Found ${seasons.length} seasons:`, seasons);
      res.json(seasons);
      
    } catch (error) {
      console.error('❌ Error in /api/seasons:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/cups - Verfügbare Cups aus Konfiguration + DB-Validierung
  app.get('/api/cups', async (req, res) => {
    try {
      console.log('🏆 API call: Get available cups');
      
      // Prüfe welche Cups tatsächlich Daten in der DB haben
      const query = `
        SELECT DISTINCT "cupType", COUNT(*) as "gameCount"
        FROM games 
        WHERE "cupType" IS NOT NULL AND "cupType" != ''
        GROUP BY "cupType"
        HAVING COUNT(*) > 0
        ORDER BY "cupType"
      `;
      
      const result = await db.query(query);
      
      // Erstelle Cup-Liste basierend auf verfügbaren Daten
      const availableCups = result.rows
        .filter(row => CUP_CONFIGS[row.cupType])
        .map(row => ({
          id: row.cupType,
          name: CUP_CONFIGS[row.cupType].name,
          gameCount: parseInt(row.gameCount)
        }));
      
      console.log(`✅ Found ${availableCups.length} cups with data:`, 
                 availableCups.map(c => `${c.name} (${c.gameCount})`));
      
      res.json(availableCups);
      
    } catch (error) {
      console.error('❌ Error in /api/cups:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/stats - Erweiterte Statistiken für Frontend
  app.get('/api/stats', async (req, res) => {
    try {
      console.log('📊 API call: Get extended stats');
      
      const queries = [
        // Statistiken pro Cup/Season
        `SELECT 
           "cupType", 
           season, 
           COUNT(*) as "totalGames",
           COUNT(CASE WHEN result IS NOT NULL AND result != '' AND result != 'TBD' THEN 1 END) as "playedGames",
           COUNT(CASE WHEN source = 'prognose' THEN 1 END) as "prognoseGames"
         FROM games 
         GROUP BY "cupType", season 
         ORDER BY season DESC, "cupType"`,
        
        // Aktuelle Season Statistiken
        `SELECT 
           COUNT(*) as "totalGames",
           COUNT(CASE WHEN result IS NOT NULL AND result != '' AND result != 'TBD' THEN 1 END) as "playedGames",
           COUNT(CASE WHEN source = 'prognose' THEN 1 END) as "prognoseGames"
         FROM games 
         WHERE season = '2025/26'`,
         
        // Letzte Updates
        `SELECT 
           "cupType",
           season,
           MAX("crawledAt") as "lastUpdate"
         FROM games 
         WHERE source != 'prognose'
         GROUP BY "cupType", season
         ORDER BY "lastUpdate" DESC
         LIMIT 10`
      ];
      
      const results = await Promise.all(queries.map(query => db.query(query)));
      
      const stats = {
        byCupSeason: results[0].rows,
        currentSeason: results[1].rows[0] || { 
          totalGames: 0, 
          playedGames: 0, 
          prognoseGames: 0 
        },
        recentUpdates: results[2].rows
      };
      
      // Konvertiere String-Zahlen zu Integers
      if (stats.currentSeason.totalGames) {
        stats.currentSeason.totalGames = parseInt(stats.currentSeason.totalGames);
        stats.currentSeason.playedGames = parseInt(stats.currentSeason.playedGames);
        stats.currentSeason.prognoseGames = parseInt(stats.currentSeason.prognoseGames);
      }
      
      console.log(`✅ Stats generated: ${stats.currentSeason.totalGames} games in current season`);
      res.json(stats);
      
    } catch (error) {
      console.error('❌ Error in /api/stats:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  console.log('✅ API-Routen für Frontend registriert');
}

module.exports = {
  register
};