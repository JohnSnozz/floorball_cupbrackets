// modules/game-routes.js - Routen für Spiel-Daten

function register(app, pool) {  // ← pool statt db
  console.log('🔧 Registriere Game-Routen...');

  // GET /games/all - Alle Spiele ohne Limit
  app.get('/games/all', async (req, res) => {
    console.log('📊 Fetching ALL games from database...');
    
    try {
      const query = 'SELECT * FROM games ORDER BY crawledat DESC';  // ← crawledat (lowercase)
      const result = await pool.query(query);
      
      console.log(`✅ Returning ${result.rows.length} total games`);
      res.json(result.rows);
      
    } catch (error) {
      console.error('❌ Error fetching all games:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /games - Spiele mit Filtern und Limit
  app.get('/games', async (req, res) => {
    const cupType = req.query.cup;
    const season = req.query.season;
    const limit = parseInt(req.query.limit) || 100;
    
    console.log(`📊 Fetching games: cup=${cupType}, season=${season}, limit=${limit}`);
    
    try {
      let query = 'SELECT * FROM games ORDER BY crawledat DESC LIMIT $1';  // ← crawledat + $1
      let params = [limit];
      
      if (cupType && season) {
        query = 'SELECT * FROM games WHERE cuptype = $1 AND season = $2 ORDER BY crawledat DESC LIMIT $3';  // ← cuptype (lowercase)
        params = [cupType, season, limit];
      } else if (cupType) {
        query = 'SELECT * FROM games WHERE cuptype = $1 ORDER BY crawledat DESC LIMIT $2';  // ← cuptype (lowercase)
        params = [cupType, limit];
      } else if (season) {
        query = 'SELECT * FROM games WHERE season = $1 ORDER BY crawledat DESC LIMIT $2';
        params = [season, limit];
      }
      
      const result = await pool.query(query, params);
      
      console.log(`✅ Returning ${result.rows.length} games (${cupType || 'all cups'}, ${season || 'all seasons'})`);
      res.json(result.rows);
      
    } catch (error) {
      console.error('❌ Error fetching games:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /stats - Datenbank-Statistiken
  app.get('/stats', async (req, res) => {
    console.log('📈 Generating database statistics...');
    
    try {
      const queries = [
        'SELECT season, cuptype, COUNT(*) as count FROM games GROUP BY season, cuptype ORDER BY season DESC, cuptype',  // ← cuptype (lowercase)
        'SELECT COUNT(*) as totalgames FROM games',  // ← totalgames (lowercase)
        'SELECT COUNT(DISTINCT tournamentid) as totaltournaments FROM games',  // ← tournamentid, totaltournaments (lowercase)
        'SELECT status, COUNT(*) as count FROM games GROUP BY status'
      ];
      
      const results = await Promise.all(queries.map(query => pool.query(query)));
      
      const stats = {
        bySeason: results[0].rows,
        totalGames: results[1].rows[0].totalgames,  // ← totalgames (lowercase)
        totalTournaments: results[2].rows[0].totaltournaments,  // ← totaltournaments (lowercase)
        byStatus: results[3].rows
      };
      
      console.log(`✅ Statistics generated: ${stats.totalGames} games, ${stats.totalTournaments} tournaments`);
      res.json(stats);
      
    } catch (error) {
      console.error('❌ Error generating statistics:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

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
      
      const result = await pool.query(query);
      const seasons = result.rows.map(row => row.season);
      
      console.log(`✅ Found ${seasons.length} seasons:`, seasons);
      res.json(seasons);
      
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
        SELECT DISTINCT cuptype, COUNT(*) as gamecount  
        FROM games 
        WHERE cuptype IS NOT NULL AND cuptype != ''
        GROUP BY cuptype
        HAVING COUNT(*) > 0
        ORDER BY cuptype
      `;
      
      const result = await pool.query(query);
      const availableCups = result.rows
        .filter(row => CUP_CONFIGS[row.cuptype])  // ← cuptype (lowercase)
        .map(row => ({
          id: row.cuptype,  // ← cuptype (lowercase)
          name: CUP_CONFIGS[row.cuptype].name,  // ← cuptype (lowercase)
          gameCount: parseInt(row.gamecount)  // ← gamecount (lowercase)
        }));
      
      console.log(`✅ Found ${availableCups.length} cups with data`);
      res.json(availableCups);
      
    } catch (error) {
      console.error('❌ Error in /api/cups:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  console.log('✅ Game-Routen registriert');
}

module.exports = {
  register
};