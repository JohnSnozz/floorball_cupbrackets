// server.js - Hauptdatei (modulare Version, bereinigt)

const express = require('express');
const path = require('path');

// App initialisieren
const app = express();
const PORT = 3000;

// Module laden (nur require, nicht initialisieren)
const dbSetup = require('./modules/database');
const middleware = require('./modules/middleware');
const cupRoutes = require('./modules/cup-routes');
const gameRoutes = require('./modules/game-routes');
const utilRoutes = require('./modules/util-routes');
const bracketSorting = require('./modules/bracket-sorting');
const bracketRoutes = require('./modules/bracket-routes');
const gameDetails = require('./modules/game-details');

// Auto-Crawl Modul nur laden wenn verfügbar
let interactiveCrawl;
try {
  interactiveCrawl = require('./modules/auto-crawl');
} catch (error) {
  console.log('⚠️  Auto-crawl module nicht gefunden oder fehlerhaft');
}

// Middleware konfigurieren
middleware.configure(app);

// Datenbank initialisieren (MUSS ZUERST!)
const db = dbSetup.initialize();

// Bracket-Sortierungs-Funktionen verfügbar machen
app.locals.bracketSorting = bracketSorting;

// Routen registrieren (NACH db-Initialisierung)
cupRoutes.register(app, db);
gameRoutes.register(app, db);
utilRoutes.register(app, db);
bracketRoutes.register(app, db);
gameDetails.register(app, db);

// GameDetailsManager initialisieren (NACH allen Routes)
const gameDetailsManager = gameDetails.initialize(db);

// Error-Handling (muss am Ende stehen)
middleware.errorHandling(app);

// Server starten
app.listen(PORT, () => {
  console.log('🚀 Swiss Cup Crawler läuft auf http://localhost:' + PORT);
  console.log('📊 Unterstützte Cups:');
  console.log('   🏒 Mobiliar Cup Herren/Damen Grossfeld');
  console.log('   🏑 Liga Cup Herren/Damen Kleinfeld');
  console.log('🎯 SQLite Datenbank bereit');
  console.log('📡 API-basiertes Crawling aktiv');
  console.log('📅 Unterstützte Saisons: 2022/23, 2023/24, 2024/25, 2025/26');
  console.log('🆔 Numerische Game IDs werden jetzt erfasst');
  console.log('🎯 Bracket-Sortierung verfügbar über API (vereinheitlicht)');
  console.log('✅ Bracket-Module bereinigt - nur bracket-sorting.js aktiv');
  console.log('🎯 GameDetails Modul geladen');
  
  // Interaktiver Crawl-Modus starten (falls verfügbar)
  if (interactiveCrawl && typeof interactiveCrawl.initializeInteractiveCrawl === 'function') {
    interactiveCrawl.initializeInteractiveCrawl(2000);
    
    // GameDetails NACH dem auto-crawl Prozess starten
    // auto-crawl braucht ca. 10-15 Sekunden für alle Abfragen
    setTimeout(() => {
      gameDetailsManager.initializeInteractiveGameDetailsCrawl();
    }, 5000); 
    
  } else {
    console.log('ℹ️  Interaktiver Crawl-Modus nicht verfügbar');
    console.log('   Erstelle modules/auto-crawl.js für automatisches Crawling');
    
    // Fallback: GameDetails direkt starten wenn kein auto-crawl
    setTimeout(() => {
      gameDetailsManager.initializeInteractiveGameDetailsCrawl();
    }, 3000);
  }
});