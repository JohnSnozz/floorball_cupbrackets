// server.js - Hauptdatei

const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');

// App initialisieren
const app = express();
const PORT = 3000;

// Module laden
const dbSetup = require('./modules/database');
const middleware = require('./modules/middleware');
const auth = require('./modules/auth');
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

// ========== SCHRITT 1: MIDDLEWARE KONFIGURIEREN ==========
console.log('🔧 Konfiguriere Middleware...');

// Basis-Middleware konfigurieren (ZUERST)
middleware.configure(app);

// Sicherheits-Middleware (NACH middleware.configure)
app.use(helmet({
  contentSecurityPolicy: false // Für Dev-Umgebung
}));

// Session-Middleware (VOR den Routen!)
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS in Produktion
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 Stunden
  }
}));

console.log('✅ Middleware konfiguriert');

// ========== SCHRITT 2: DATENBANK INITIALISIEREN ==========
console.log('🗄️ Initialisiere Datenbank...');
const db = dbSetup.initialize();

// Bracket-Sortierungs-Funktionen verfügbar machen
app.locals.bracketSorting = bracketSorting;

console.log('✅ Datenbank initialisiert');

// ========== SCHRITT 3: AUTH-ROUTEN REGISTRIEREN (VOR anderen Routen) ==========
console.log('🔐 Registriere Auth-System...');
auth.register(app, db);
console.log('✅ Auth-System registriert');

// ========== SCHRITT 4: ALLE ANDEREN ROUTEN REGISTRIEREN ==========
console.log('🔗 Registriere Anwendungs-Routen...');

cupRoutes.register(app, db);
gameRoutes.register(app, db);
utilRoutes.register(app, db);
bracketRoutes.register(app, db);
prognoseGames.register(app, db);
backendApi.register(app, db);
apiRoutes.register(app, db);
gameDetails.register(app, db);
gameEvents.register(app, db);

console.log('✅ Alle Routen registriert');

// ========== SCHRITT 5: ERROR-HANDLING (GANZ ZUM SCHLUSS) ==========
console.log('⚠️ Konfiguriere Error-Handling...');
middleware.errorHandling(app);
console.log('✅ Error-Handling konfiguriert');

// ========== SCHRITT 6: SERVER STARTEN ==========
app.listen(PORT, () => {
  console.log('\n🎉 Swiss Cup Crawler gestartet!');
  console.log('=' .repeat(50));
  console.log(`🌐 Server läuft auf: http://localhost:${PORT}`);
  console.log(`🔐 Backend Login: http://localhost:${PORT}/dev/`);
  console.log('=' .repeat(50));
  console.log('📊 Unterstützte Cups:');
  console.log('   🏒 Mobiliar Cup Herren/Damen Grossfeld');
  console.log('   🏑 Liga Cup Herren/Damen Kleinfeld');
  console.log('📅 Unterstützte Saisons: 2022/23, 2023/24, 2024/25, 2025/26');
  console.log('=' .repeat(50));
  console.log('🔧 Verfügbare Features:');
  console.log('   ✅ PostgreSQL Datenbank');
  console.log('   ✅ API-basiertes Crawling');
  console.log('   ✅ Numerische Game IDs');
  console.log('   ✅ Bracket-Sortierung');
  console.log('   ✅ Prognose-Spiele Generator');
  console.log('   ✅ GameDetails & GameEvents');
  console.log('   ✅ Backend Authentication');
  console.log('=' .repeat(50));
  
  // Session-Secret Check
  if (!process.env.SESSION_SECRET) {
    console.log('⚠️  WARNUNG: SESSION_SECRET nicht in .env gesetzt!');
    console.log('💡 Login wird nicht funktionieren ohne SESSION_SECRET');
  } else {
    console.log('🔐 Auth-System bereit');
  }
  
  console.log('\n🚀 Server bereit für Anfragen!');
});