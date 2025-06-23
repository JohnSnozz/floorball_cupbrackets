// server.js - Hauptdatei

const express = require('express');
const path = require('path');

// App initialisieren
const app = express();
const PORT = 3000;

// Module laden
const dbSetup = require('./modules/database');
const middleware = require('./modules/middleware');
const cupRoutes = require('./modules/cup-routes');
const gameRoutes = require('./modules/game-routes');
const utilRoutes = require('./modules/util-routes');
const bracketSorting = require('./modules/bracket-sorting');
const bracketRoutes = require('./modules/bracket-routes');
const prognoseGames = require('./modules/prognose-games');
const backendApi = require('./modules/backend-api');
const apiRoutes = require('./modules/api-routes');
const gameDetails = require('./modules/game-details');
const gameEvents = require('./modules/game-events');

// Auto-Crawl Modul nur laden wenn verfügbar
let autoCrawl;
try {
  autoCrawl = require('./modules/auto-crawl');
} catch (error) {
  console.log('Auto-crawl module nicht gefunden oder fehlerhaft');
}

// Middleware konfigurieren
middleware.configure(app);

// Datenbank initialisieren
const db = dbSetup.initialize();

// Bracket-Sortierungs-Funktionen verfügbar machen
app.locals.bracketSorting = bracketSorting;

// Routen registrieren
cupRoutes.register(app, db);
gameRoutes.register(app, db);
utilRoutes.register(app, db);
bracketRoutes.register(app, db);
prognoseGames.register(app, db);
backendApi.register(app, db);
apiRoutes.register(app, db);
gameDetails.register(app, db);
gameEvents.register(app, db);

// Error-Handling
middleware.errorHandling(app);

// Server starten
app.listen(PORT, () => {
  console.log('Swiss Cup Crawler läuft auf http://localhost:' + PORT);
  console.log('Unterstützte Cups:');
  console.log('   Mobiliar Cup Herren/Damen Grossfeld');
  console.log('   Liga Cup Herren/Damen Kleinfeld');
  console.log('SQLite Datenbank bereit');
  console.log('API-basiertes Crawling aktiv');
  console.log('Unterstützte Saisons: 2022/23, 2023/24, 2024/25, 2025/26');
  console.log('Numerische Game IDs werden jetzt erfasst');
  console.log('Bracket-Sortierung verfügbar über API');
  console.log('Prognose-Spiele Modul geladen');
  console.log('GameDetails und GameEvents Module aktiv');
});