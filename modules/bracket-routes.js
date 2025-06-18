// modules/bracket-routes.js
// Express-Routen für Bracket-Sortierung

const bracketSorting = require('./bracket-sorting');

function register(app, db) {
    
    /**
     * POST /calculate-bracket-sorting
     * Berechnet Bracket-Sortierung für alle Events
     */
    app.post('/calculate-bracket-sorting', async (req, res) => {
        try {
            console.log('🎯 API call: Calculate bracket sorting for all events');
            
            // Stelle sicher, dass bracketSortOrder Spalte existiert
            await bracketSorting.addBracketSortOrderColumn(db);
            
            // Berechne Sortierung für alle Events
            await bracketSorting.calculateBracketSortingForAll(db);
            
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
     * POST /calculate-bracket-sorting/:cupType/:season
     * Berechnet Bracket-Sortierung für ein spezifisches Event
     */
    app.post('/calculate-bracket-sorting/:cupType/:season', async (req, res) => {
        try {
            const { cupType, season } = req.params;
            console.log(`🎯 API call: Calculate bracket sorting for ${cupType} - ${season}`);
            
            // Stelle sicher, dass bracketSortOrder Spalte existiert
            await bracketSorting.addBracketSortOrderColumn(db);
            
            // Berechne Sortierung für spezifisches Event
            await bracketSorting.calculateBracketSortingForEvent(db, cupType, season);
            
            res.json({
                success: true,
                message: `Bracket sorting calculated successfully for ${cupType} - ${season}`,
                cupType,
                season,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error(`❌ Error calculating bracket sorting for ${cupType} - ${season}:`, error);
            res.status(500).json({
                success: false,
                error: error.message,
                cupType: req.params.cupType,
                season: req.params.season
            });
        }
    });
    
    /**
     * GET /bracket-sorting-status
     * Zeigt Status der Bracket-Sortierung für alle Events
     */
    app.get('/bracket-sorting-status', (req, res) => {
        const query = `
            SELECT 
                cupType,
                season,
                COUNT(*) as totalGames,
                COUNT(bracketSortOrder) as sortedGames,
                ROUND(COUNT(bracketSortOrder) * 100.0 / COUNT(*), 1) as sortingPercentage
            FROM games
            GROUP BY cupType, season
            ORDER BY cupType, season
        `;
        
        db.all(query, [], (err, rows) => {
            if (err) {
                console.error('❌ Error getting bracket sorting status:', err);
                res.status(500).json({
                    success: false,
                    error: err.message
                });
            } else {
                res.json({
                    success: true,
                    events: rows,
                    timestamp: new Date().toISOString()
                });
            }
        });
    });
    
    /**
     * GET /bracket-sorting-details/:cupType/:season
     * Zeigt detaillierte Bracket-Sortierung für ein Event
     */
    app.get('/bracket-sorting-details/:cupType/:season', (req, res) => {
        const { cupType, season } = req.params;
        
        const query = `
            SELECT 
                roundName,
                gameId,
                numericGameId,
                bracketSortOrder,
                team1,
                team2,
                result
            FROM games
            WHERE cupType = ? AND season = ?
            ORDER BY 
                CASE 
                    WHEN roundName LIKE '%finale%' OR roundName LIKE '%final%' OR roundName LIKE '%1/1%' THEN 1000
                    WHEN roundName LIKE '%halbfinale%' OR roundName LIKE '%1/2%' THEN 900
                    WHEN roundName LIKE '%viertelfinale%' OR roundName LIKE '%1/4%' THEN 800
                    WHEN roundName LIKE '%achtelfinale%' OR roundName LIKE '%1/8%' THEN 700
                    WHEN roundName LIKE '%1/16%' THEN 600
                    WHEN roundName LIKE '%1/32%' THEN 500
                    WHEN roundName LIKE '%1/64%' THEN 400
                    WHEN roundName LIKE '%1/128%' THEN 300
                    ELSE 100
                END DESC,
                bracketSortOrder ASC,
                CAST(numericGameId AS INTEGER) ASC
        `;
        
        db.all(query, [cupType, season], (err, rows) => {
            if (err) {
                console.error(`❌ Error getting bracket sorting details for ${cupType} - ${season}:`, err);
                res.status(500).json({
                    success: false,
                    error: err.message
                });
            } else {
                // Gruppiere nach Runden
                const rounds = {};
                rows.forEach(game => {
                    if (!rounds[game.roundName]) {
                        rounds[game.roundName] = [];
                    }
                    rounds[game.roundName].push(game);
                });
                
                res.json({
                    success: true,
                    cupType,
                    season,
                    totalGames: rows.length,
                    rounds,
                    timestamp: new Date().toISOString()
                });
            }
        });
    });
}

module.exports = { register };