// game-details.js - GameDetails Backend API Module (PostgreSQL-kompatibel)

function register(app, db) {
    console.log('🎮 Registering GameDetails API routes...');
    
    // API Route: Get all game details or filter by season
    app.get('/api/game-details', async (req, res) => {
        try {
            const { season, limit = 1000 } = req.query;
            
            let query = 'SELECT * FROM gamedetails';
            let params = [];
            
            if (season) {
                query += ' WHERE season = $1';
                params.push(season);
            }
            
            query += ' ORDER BY lastupdated DESC';
            
            if (limit && parseInt(limit) > 0) {
                query += ` LIMIT ${parseInt(limit)}`;
            }
            
            const result = await db.query(query, params);
            console.log(`📊 GameDetails API: ${result.rows.length} records returned`);
            
            res.json(result.rows);
            
        } catch (error) {
            console.error('Error fetching game details:', error);
            res.status(500).json({ error: 'Database error', details: error.message });
        }
    });
    
    // API Route: Get game details by numeric game ID
    app.get('/api/game-details/:gameId', async (req, res) => {
        try {
            const { gameId } = req.params;
            
            const query = 'SELECT * FROM gamedetails WHERE numericgameid = $1 LIMIT 1';
            const result = await db.query(query, [gameId]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Game not found' });
            }
            
            console.log(`🎯 GameDetails API: Found game ${gameId}`);
            res.json(result.rows[0]);
            
        } catch (error) {
            console.error('Error fetching game detail:', error);
            res.status(500).json({ error: 'Database error', details: error.message });
        }
    });
    
    // API Route: Get basic statistics
    app.get('/api/game-details/stats', async (req, res) => {
        try {
            const query = `
                SELECT 
                    COUNT(*) as totalgames,
                    COUNT(CASE WHEN result IS NOT NULL AND result != '' THEN 1 END) as gameswithresults,
                    COUNT(CASE WHEN spectators IS NOT NULL AND spectators > 0 THEN 1 END) as gameswithspectators,
                    AVG(CASE WHEN spectators IS NOT NULL AND spectators > 0 THEN spectators END) as avgspectators,
                    COUNT(CASE WHEN first_referee IS NOT NULL AND first_referee != '' THEN 1 END) as gameswithreferees
                FROM gamedetails
            `;
            
            const result = await db.query(query);
            console.log('📊 GameDetails Stats:', result.rows[0]);
            
            res.json(result.rows[0]);
            
        } catch (error) {
            console.error('Error fetching game details stats:', error);
            res.status(500).json({ error: 'Database error', details: error.message });
        }
    });
    
    // API Route: Get available seasons
    app.get('/api/game-details/seasons', async (req, res) => {
        try {
            const query = 'SELECT DISTINCT season FROM gamedetails WHERE season IS NOT NULL ORDER BY season DESC';
            const result = await db.query(query);
            
            const seasons = result.rows.map(row => row.season);
            console.log('📊 Available seasons:', seasons);
            
            res.json(seasons);
            
        } catch (error) {
            console.error('Error fetching seasons:', error);
            res.status(500).json({ error: 'Database error', details: error.message });
        }
    });
    
    // API Route: Get season-specific statistics
    app.get('/api/game-details/season-stats', async (req, res) => {
        try {
            const query = `
                SELECT 
                    season,
                    COUNT(*) as totalgames,
                    COUNT(CASE WHEN result IS NOT NULL AND result != '' THEN 1 END) as gameswithresults,
                    MAX(lastupdated) as lastupdate
                FROM gamedetails 
                WHERE season IS NOT NULL 
                GROUP BY season 
                ORDER BY season DESC
            `;
            
            const result = await db.query(query);
            console.log('📊 Season stats:', result.rows);
            
            res.json(result.rows);
            
        } catch (error) {
            console.error('Error fetching season stats:', error);
            res.status(500).json({ error: 'Database error', details: error.message });
        }
    });
    
    // API Route: Delete all game details for a season
    app.delete('/api/game-details/season/:season', async (req, res) => {
        try {
            const { season } = req.params;
            
            const query = 'DELETE FROM gamedetails WHERE season = $1';
            const result = await db.query(query, [season]);
            
            console.log(`🗑️ Deleted ${result.rowCount} game details for season ${season}`);
            
            res.json({ 
                success: true, 
                deleted: result.rowCount,
                season: season
            });
            
        } catch (error) {
            console.error('Error deleting season game details:', error);
            res.status(500).json({ error: 'Database error', details: error.message });
        }
    });
    
    // API Route: Crawl game details for specific season
    app.post('/api/crawl-game-details/:season', async (req, res) => {
        try {
            const { season } = req.params;
            
            // This would typically trigger your crawling logic
            // For now, return a placeholder response
            console.log(`🕷️ Crawling game details for season ${season}...`);
            
            // TODO: Implement actual crawling logic here
            // This might involve calling external APIs or scraping websites
            
            res.json({
                success: 0,
                errors: 0,
                message: `Crawling for season ${season} completed`,
                season: season
            });
            
        } catch (error) {
            console.error('Error crawling game details:', error);
            res.status(500).json({ error: 'Crawling error', details: error.message });
        }
    });
    
    console.log('✅ GameDetails API routes registered');
}

module.exports = { register };