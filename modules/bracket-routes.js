// modules/bracket-routes.js
// Express-Routen für Bracket-Sortierung (PostgreSQL)

const bracketSorting = require('./bracket-sorting');

function register(app, pool) {  // pool statt db
    
    /**
     * POST /calculate-bracket-sorting
     * Berechnet Bracket-Sortierung für alle Events
     */
    app.post('/calculate-bracket-sorting', async (req, res) => {
        try {
            console.log('🎯 API call: Calculate bracket sorting for all events');
            
            // Stelle sicher, dass bracketsortorder Spalte existiert
            await bracketSorting.addBracketSortOrderColumn(pool);
            
            // Berechne Sortierung für alle Events
            await bracketSorting.calculateBracketSortingForAll(pool);
            
            res.json({
                success: true,
                message: 'Bracket sorting calculated successfully for all events',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Error calculating bracket sorting:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    
    /**
     * POST /calculate-bracket-sorting/:cuptype/:season
     * Berechnet Bracket-Sortierung für ein spezifisches Event
     */
    app.post('/calculate-bracket-sorting/:cuptype/:season', async (req, res) => {
        try {
            const { cuptype, season } = req.params;
            console.log(`🎯 API call: Calculate bracket sorting for ${cuptype} - ${season}`);
            
            // Stelle sicher, dass bracketsortorder Spalte existiert
            await bracketSorting.addBracketSortOrderColumn(pool);
            
            // Berechne Sortierung für spezifisches Event
            await bracketSorting.calculateBracketSortingForEvent(pool, cuptype, season);
            
            res.json({
                success: true,
                message: `Bracket sorting calculated successfully for ${cuptype} - ${season}`,
                cuptype,
                season,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error(`❌ Error calculating bracket sorting for ${cuptype} - ${season}:`, error);
            res.status(500).json({
                success: false,
                error: error.message,
                cuptype: req.params.cuptype,
                season: req.params.season
            });
        }
    });
    
    /**
     * GET /bracket-sorting-status
     * Zeigt Status der Bracket-Sortierung für alle Events
     */
    app.get('/bracket-sorting-status', async (req, res) => {
        try {
            const query = `
                SELECT 
                    "cuptype",
                    season,
                    COUNT(*) as "totalGames",
                    COUNT("bracketsortorder") as "sortedGames",
                    ROUND(COUNT("bracketsortorder") * 100.0 / COUNT(*), 1) as "sortingPercentage"
                FROM games
                GROUP BY "cuptype", season
                ORDER BY "cuptype", season
            `;
            
            const result = await pool.query(query);
            
            res.json({
                success: true,
                events: result.rows,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Error getting bracket sorting status:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    
    /**
     * GET /bracket-sorting-details/:cuptype/:season
     * Zeigt detaillierte Bracket-Sortierung für ein Event
     */
    app.get('/bracket-sorting-details/:cuptype/:season', async (req, res) => {
        try {
            const { cuptype, season } = req.params;
            
            const query = `
                SELECT 
                    "roundName",
                    "gameId",
                    "numericGameId",
                    "bracketsortorder",
                    team1,
                    team2,
                    result
                FROM games
                WHERE "cuptype" = $1 AND season = $2
                ORDER BY 
                    CASE 
                        WHEN "roundName" ILIKE '%finale%' OR "roundName" ILIKE '%final%' OR "roundName" ILIKE '%1/1%' THEN 1000
                        WHEN "roundName" ILIKE '%halbfinale%' OR "roundName" ILIKE '%1/2%' THEN 900
                        WHEN "roundName" ILIKE '%viertelfinale%' OR "roundName" ILIKE '%1/4%' THEN 800
                        WHEN "roundName" ILIKE '%achtelfinale%' OR "roundName" ILIKE '%1/8%' THEN 700
                        WHEN "roundName" ILIKE '%1/16%' THEN 600
                        WHEN "roundName" ILIKE '%1/32%' THEN 500
                        WHEN "roundName" ILIKE '%1/64%' THEN 400
                        WHEN "roundName" ILIKE '%1/128%' THEN 300
                        ELSE 100
                    END DESC,
                    "bracketsortorder" ASC,
                    CAST("numericGameId" AS INTEGER) ASC
            `;
            
            const result = await pool.query(query, [cuptype, season]);
            
            // Gruppiere nach Runden
            const rounds = {};
            result.rows.forEach(game => {
                if (!rounds[game.roundName]) {
                    rounds[game.roundName] = [];
                }
                rounds[game.roundName].push(game);
            });
            
            res.json({
                success: true,
                cuptype,
                season,
                totalGames: result.rows.length,
                rounds,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error(`❌ Error getting bracket sorting details for ${cuptype} - ${season}:`, error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
}

module.exports = { register };