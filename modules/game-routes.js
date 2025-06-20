// modules/game-routes.js - Routen für Spiel-Daten

function register(app, db) {
  console.log('🔧 Registriere Game-Routen...');

  // GET /games/all - Alle Spiele ohne Limit
  app.get('/games/all', async (req, res) => {
    console.log('📊 Fetching ALL games from database...');
    
    const query = 'SELECT * FROM games ORDER BY crawledAt DESC';
    
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('❌ Error fetching all games:', err.message);
        res.status(500).json({ error: err.message });
      } else {
        console.log(`✅ Returning ${rows.length} total games`);
        res.json(rows);
      }
    });
  });

  // GET /games - Spiele mit Filtern und Limit
  app.get('/games', async (req, res) => {
    const cupType = req.query.cup;
    const season = req.query.season;
    const limit = parseInt(req.query.limit) || 100;
    
    console.log(`📊 Fetching games: cup=${cupType}, season=${season}, limit=${limit}`);
    
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
        console.error('❌ Error fetching games:', err.message);
        res.status(500).json({ error: err.message });
      } else {
        console.log(`✅ Returning ${rows.length} games (${cupType || 'all cups'}, ${season || 'all seasons'})`);
        res.json(rows);
      }
    });
  });

  // GET /stats - Datenbank-Statistiken
  app.get('/stats', async (req, res) => {
    console.log('📈 Generating database statistics...');
    
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
      
      const stats = {
        bySeason: results[0],
        totalGames: results[1][0].totalGames,
        totalTournaments: results[2][0].totalTournaments,
        byStatus: results[3]
      };
      
      console.log(`✅ Statistics generated: ${stats.totalGames} games, ${stats.totalTournaments} tournaments`);
      res.json(stats);
      
    } catch (error) {
      console.error('❌ Error generating statistics:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  console.log('✅ Game-Routen registriert');
}

// Füge diese Routes zu modules/game-routes.js hinzu (am Ende der register function):

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
    
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('❌ Error fetching seasons:', err.message);
        res.status(500).json({ error: err.message });
      } else {
        const seasons = rows.map(row => row.season);
        console.log(`✅ Found ${seasons.length} seasons:`, seasons);
        res.json(seasons);
      }
    });
    
  } catch (error) {
    console.error('❌ Error in /api/seasons:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/cups - Verfügbare Cups
app.get('/api/cups', async (req, res) => {
  try {
    console.log('🏆 API call: Get available cups');
    
    // Cup-Konfiguration
    const CUP_CONFIGS = {
      herren_grossfeld: { name: 'Grossfeld Herren' },
      damen_grossfeld: { name: 'Grossfeld Damen' },
      herren_kleinfeld: { name: 'Kleinfeld Herren' },
      damen_kleinfeld: { name: 'Kleinfeld Damen' }
    };
    
    const query = `
      SELECT DISTINCT cupType, COUNT(*) as gameCount
      FROM games 
      WHERE cupType IS NOT NULL AND cupType != ''
      GROUP BY cupType
      HAVING gameCount > 0
      ORDER BY cupType
    `;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('❌ Error fetching cups:', err.message);
        res.status(500).json({ error: err.message });
      } else {
        const availableCups = rows
          .filter(row => CUP_CONFIGS[row.cupType])
          .map(row => ({
            id: row.cupType,
            name: CUP_CONFIGS[row.cupType].name,
            gameCount: row.gameCount
          }));
        
        console.log(`✅ Found ${availableCups.length} cups with data`);
        res.json(availableCups);
      }
    });
    
  } catch (error) {
    console.error('❌ Error in /api/cups:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = {
  register
};