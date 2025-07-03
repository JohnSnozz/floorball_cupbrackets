// ERWEITERTE game-routes.js - JOIN mit gamedetails für vollständige Results

function register(app, pool) {
  console.log('🔧 Registriere Enhanced Game-Routen...');

  // GET /games/all - Alle Spiele ohne Limit mit gamedetails JOIN
  app.get('/games/all', async (req, res) => {
    console.log('📊 Fetching ALL games with enhanced results...');
    
    try {
      // ENHANCED QUERY: JOIN mit gamedetails für vollständige Results
      const query = `
        SELECT 
          g.*,
          COALESCE(gd.result, g.result) as enhanced_result,
          gd.result as gamedetails_result,
          g.result as games_result
        FROM games g
        LEFT JOIN gamedetails gd ON g.numericgameid = gd.numericgameid
        ORDER BY g.crawledat DESC
      `;
      
      const result = await pool.query(query);
      
      // Ersetze result mit enhanced_result für bessere Overtime-Unterstützung
      const enhancedGames = result.rows.map(game => ({
        ...game,
        result: game.enhanced_result || game.games_result || '',
        // Debug-Info (kann später entfernt werden)
        _debug: {
          original_result: game.games_result,
          gamedetails_result: game.gamedetails_result,
          used_enhanced: game.enhanced_result !== game.games_result
        }
      }));
      
      console.log(`✅ Returning ${enhancedGames.length} games with enhanced results`);
      
      // Debug: Zeige Overtime-Spiele
      const overtimeGames = enhancedGames.filter(game => 
        game.result && (game.result.includes('n.V.') || game.result.includes('n.P.'))
      );
      console.log(`🏒 Found ${overtimeGames.length} overtime games with enhanced results`);
      
      res.json(enhancedGames);
      
    } catch (error) {
      console.error('❌ Error fetching enhanced games:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /games - Spiele mit Filtern und Limit - ENHANCED VERSION
  app.get('/games', async (req, res) => {
    const cuptype = req.query.cup;
    const season = req.query.season;
    const limit = parseInt(req.query.limit) || 100;
    
    console.log(`📊 Fetching enhanced games: cup=${cuptype}, season=${season}, limit=${limit}`);
    
    try {
      let query = `
        SELECT 
          g.*,
          COALESCE(gd.result, g.result) as enhanced_result,
          gd.result as gamedetails_result,
          g.result as games_result
        FROM games g
        LEFT JOIN gamedetails gd ON g.numericgameid = gd.numericgameid
      `;
      
      let whereConditions = [];
      let params = [];
      
      if (cuptype && season) {
        whereConditions.push('g.cuptype = $1', 'g.season = $2');
        params.push(cuptype, season);
      } else if (cuptype) {
        whereConditions.push('g.cuptype = $1');
        params.push(cuptype);
      } else if (season) {
        whereConditions.push('g.season = $1');
        params.push(season);
      }
      
      if (whereConditions.length > 0) {
        query += ' WHERE ' + whereConditions.join(' AND ');
      }
      
      query += ' ORDER BY g.crawledat DESC';
      
      if (limit > 0) {
        query += ` LIMIT $${params.length + 1}`;
        params.push(limit);
      }
      
      const result = await pool.query(query, params);
      
      // Ersetze result mit enhanced_result
      const enhancedGames = result.rows.map(game => ({
        ...game,
        result: game.enhanced_result || game.games_result || '',
        // Debug-Info für Development
        _debug: {
          original_result: game.games_result,
          gamedetails_result: game.gamedetails_result,
          used_enhanced: game.enhanced_result !== game.games_result
        }
      }));
      
      console.log(`✅ Returning ${enhancedGames.length} enhanced games (${cuptype || 'all cups'}, ${season || 'all seasons'})`);
      
      // Debug: Overtime-Spiele zählen
      const overtimeGames = enhancedGames.filter(game => 
        game.result && (game.result.includes('n.V.') || game.result.includes('n.P.'))
      );
      if (overtimeGames.length > 0) {
        console.log(`🏒 Found ${overtimeGames.length} overtime games in this result set`);
        overtimeGames.forEach(game => {
          console.log(`  - ${game.team1} vs ${game.team2}: "${game.result}"`);
        });
      }
      
      res.json(enhancedGames);
      
    } catch (error) {
      console.error('❌ Error fetching enhanced games:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /stats - Datenbank-Statistiken (unverändert)
  app.get('/stats', async (req, res) => {
    console.log('📈 Generating database statistics...');
    
    try {
      const queries = [
        'SELECT season, cuptype, COUNT(*) as count FROM games GROUP BY season, cuptype ORDER BY season DESC, cuptype',
        'SELECT COUNT(*) as totalgames FROM games',
        'SELECT COUNT(DISTINCT tournamentid) as totaltournaments FROM games',
        'SELECT status, COUNT(*) as count FROM games GROUP BY status'
      ];
      
      const results = await Promise.all(queries.map(query => pool.query(query)));
      
      const stats = {
        bySeason: results[0].rows,
        totalGames: parseInt(results[1].rows[0].totalgames),
        totalTournaments: parseInt(results[2].rows[0].totaltournaments),
        byStatus: results[3].rows
      };
      
      console.log(`✅ Statistics generated: ${stats.totalGames} games, ${stats.totalTournaments} tournaments`);
      res.json(stats);
      
    } catch (error) {
      console.error('❌ Error generating statistics:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/seasons - Verfügbare Seasons aus DB (unverändert)
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

  // GET /api/cups - Verfügbare Cups (unverändert)
  app.get('/api/cups', async (req, res) => {
    try {
      console.log('🏆 API call: Get available cups');
      
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
        .filter(row => CUP_CONFIGS[row.cuptype])
        .map(row => ({
          id: row.cuptype,
          name: CUP_CONFIGS[row.cuptype].name,
          gameCount: parseInt(row.gamecount)
        }));
      
      console.log(`✅ Found ${availableCups.length} cups with data`);
      res.json(availableCups);
      
    } catch (error) {
      console.error('❌ Error in /api/cups:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // NEW: Debug-Endpoint um JOIN-Results zu testen
  app.get('/games/debug/:gameId', async (req, res) => {
    try {
      const gameId = parseInt(req.params.gameId);
      
      const query = `
        SELECT 
          g.numericgameid,
          g.team1,
          g.team2,
          g.result as games_result,
          gd.result as gamedetails_result,
          COALESCE(gd.result, g.result) as enhanced_result
        FROM games g
        LEFT JOIN gamedetails gd ON g.numericgameid = gd.numericgameid
        WHERE g.numericgameid = $1
      `;
      
      const result = await pool.query(query, [gameId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Game not found' });
      }
      
      const game = result.rows[0];
      
      res.json({
        gameId: game.numericgameid,
        teams: `${game.team1} vs ${game.team2}`,
        games_result: game.games_result,
        gamedetails_result: game.gamedetails_result,
        enhanced_result: game.enhanced_result,
        has_overtime: game.enhanced_result && (game.enhanced_result.includes('n.V.') || game.enhanced_result.includes('n.P.')),
        enhancement_applied: game.enhanced_result !== game.games_result
      });
      
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  console.log('✅ Enhanced Game-Routen mit gamedetails JOIN registriert');
}

module.exports = {
  register
};