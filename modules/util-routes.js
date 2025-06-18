// modules/util-routes.js - Utility-Routen (Health, Clear, Static)

const path = require('path');

function register(app, db) {
  console.log('🔧 Registriere Utility-Routen...');

  // GET /health - Health Check
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version
    });
  });

  // GET /calculate-bracket-sorting - Bracket-Sortierung berechnen
  app.get('/calculate-bracket-sorting', async (req, res) => {
    try {
      console.log('🧮 Starting bracket sorting calculation...');
      
      // Importiere die Bracket-Logik
      const bracketSorting = require('./bracket-sorting');
      await bracketSorting.addBracketSortOrderColumn(db);
      await bracketSorting.calculateBracketSortingForAll(db);
      
      console.log('✅ Bracket sorting calculation completed');
      res.json({ success: true, message: 'Bracket sorting calculated' });
    } catch (error) {
      console.error('❌ Error calculating bracket sorting:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // GET / - Hauptseite
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  // GET /bracket - Bracket-Seite
  app.get('/bracket', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'bracket.html'));
  });

  // GET /dbreview - Datenbank-Review-Seite
  app.get('/dbreview', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'dbreview.html'));
  });

  console.log('✅ Utility-Routen registriert');
}

module.exports = {
  register
};