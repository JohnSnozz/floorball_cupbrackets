// server.js - Hauptdatei (zentrale Benutzerabfragen)

const express = require('express');
const path = require('path');
const readline = require('readline');

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
let autoCrawl;
try {
  autoCrawl = require('./modules/auto-crawl');
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

// =====================================
//      ZENTRALE BENUTZERABFRAGEN
// =====================================

/**
 * Erstellt readline Interface für Benutzereingaben
 */
function createReadlineInterface() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
}

/**
 * Stellt eine Ja/Nein Frage an den Benutzer
 */
function askQuestion(rl, question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            const normalizedAnswer = answer.toLowerCase().trim();
            resolve(normalizedAnswer === 'y' || normalizedAnswer === 'yes' || normalizedAnswer === 'j' || normalizedAnswer === 'ja');
        });
    });
}

/**
 * Zentrale interaktive Abfrage für alle Crawling-Optionen
 */
async function runInteractiveSetup() {
    console.log('\n🎯 Swiss Cup Crawler - Interaktiver Setup');
    console.log('═'.repeat(50));
    
    const rl = createReadlineInterface();
    
    try {
        // 1. Crawling-Abfrage
        console.log('\n📊 Verfügbare Daten:');
        console.log('   📅 Saisons: 2022/23, 2023/24, 2024/25, 2025/26');
        console.log('   🏒 Cups: 4 verschiedene Cups (Herren/Damen, Gross-/Kleinfeld)');
        console.log('   📈 Total: 16 Events\n');
        
        const shouldCrawlGames = await askQuestion(rl, '❓ Sollen alle Cup-Daten gecrawlt werden? (y/n): ');
        
        // 2. Bracket-Sortierung-Abfrage
        const shouldCalculateBrackets = await askQuestion(rl, '❓ Soll die Bracket-Sortierung berechnet werden? (y/n): ');
        
        // 3. GameDetails-Abfrage
        const shouldCrawlDetails = await askQuestion(rl, '❓ Sollen Spieldetails (Events) gecrawlt werden? (y/n): ');
        
        rl.close();
        
        // Aktionen sequenziell ausführen
        await executeUserChoices(shouldCrawlGames, shouldCalculateBrackets, shouldCrawlDetails);
        
    } catch (error) {
        console.error('\n❌ Fehler während des interaktiven Setups:', error.message);
        rl.close();
    }
}

/**
 * Führt die gewählten Aktionen sequenziell aus
 */
async function executeUserChoices(crawlGames, calculateBrackets, crawlDetails) {
    console.log('\n🚀 Starte gewählte Aktionen...');
    console.log('═'.repeat(50));
    
    let stepCount = 1;
    const totalSteps = [crawlGames, calculateBrackets, crawlDetails].filter(Boolean).length;
    
    // 1. Cup-Daten crawlen
    if (crawlGames && autoCrawl) {
        console.log(`\n🎯 ${stepCount}/${totalSteps}: Crawle Cup-Daten...`);
        stepCount++;
        try {
            await autoCrawl.performAutoCrawling();
        } catch (error) {
            console.error('❌ Fehler beim Cup-Crawling:', error.message);
        }
    } else if (crawlGames) {
        console.log('\n⚠️  Auto-crawl Modul nicht verfügbar');
    } else {
        console.log('\n⏭️  Cup-Crawling übersprungen');
    }
    
    // 2. Bracket-Sortierung berechnen
    if (calculateBrackets) {
        console.log(`\n🎯 ${stepCount}/${totalSteps}: Berechne Bracket-Sortierung...`);
        stepCount++;
        try {
            await performBracketCalculation();
        } catch (error) {
            console.error('❌ Fehler bei Bracket-Sortierung:', error.message);
        }
    } else {
        console.log('\n⏭️  Bracket-Sortierung übersprungen');
    }
    
    // 3. GameDetails crawlen
    if (crawlDetails) {
        console.log(`\n🎯 ${stepCount}/${totalSteps}: Crawle Spieldetails...`);
        try {
            const result = await gameDetailsManager.crawlAllGameDetails();
            console.log(`✅ GameDetails: ${result.success} erfolgreich, ${result.errors} Fehler`);
        } catch (error) {
            console.error('❌ Fehler beim GameDetails-Crawling:', error.message);
        }
    } else {
        console.log('\n⏭️  GameDetails-Crawling übersprungen');
    }
    
    console.log('\n🎉 Setup abgeschlossen!');
    console.log('═'.repeat(50));
}

/**
 * Führt die Bracket-Sortierung durch
 */
async function performBracketCalculation() {
    try {
        console.log('   🔄 Berechne Bracket-Sortierung...');
        
        // Direkt die Funktion aus dem bracket-sorting Modul aufrufen
        await bracketSorting.addBracketSortOrderColumn(db);
        await bracketSorting.calculateBracketSortingForAll(db);
        
        console.log('   ✅ Bracket-Sortierung erfolgreich abgeschlossen');
        
    } catch (error) {
        console.log(`   ❌ Bracket-Sortierung fehlgeschlagen: ${error.message}`);
    }
}

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
  
  // Interaktiver Setup nach kurzer Verzögerung
  setTimeout(() => {
    runInteractiveSetup();
  }, 2000);
});