// server.js - Hauptdatei (zentrale Benutzerabfragen)

const express = require('express');
const path = require('path');
const readline = require('readline');
const fetch = require('node-fetch');

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
const prognoseGames = require('./modules/prognose-games');
const backendApi = require('./modules/backend-api');
const apiRoutes = require('./modules/api-routes');
const gameDetails  = require('./modules/game-details');



// Auto-Crawl Modul nur laden wenn verfügbar
let autoCrawl;
try {
  autoCrawl = require('./modules/auto-crawl');
} catch (error) {
  console.log('Auto-crawl module nicht gefunden oder fehlerhaft');
}

// Aktuelle Saison definieren
const CURRENT_SEASON = '2025/26';
const CURRENT_CUPS = [
  'herren_grossfeld',
  'damen_grossfeld', 
  'herren_kleinfeld',
  'damen_kleinfeld'
];

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
prognoseGames.register(app, db);
backendApi.register(app, db);
apiRoutes.register(app, db);
gameDetails.register(app, db);


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
 * Stellt eine Frage an den Benutzer
 */
function askQuestion(rl, question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.toLowerCase().trim());
        });
    });
}

/**
 * Crawlt alle Cups für eine spezifische Saison
 */
async function crawlCurrentSeason(season) {
    if (!autoCrawl) {
        console.log('Auto-crawl Modul nicht verfügbar');
        return;
    }

    console.log(`Crawling Cups für Saison ${season}...`);
    
    let totalSuccessful = 0;
    let totalFailed = 0;
    let totalNewGames = 0;
    let totalUpdatedGames = 0;
    let totalSkippedPlayed = 0;
    
    for (let i = 0; i < CURRENT_CUPS.length; i++) {
        const cup = CURRENT_CUPS[i];
        const progress = ((i + 1) / CURRENT_CUPS.length * 100).toFixed(0);
        
        process.stdout.write(`\r[${progress.padStart(3)}%] ${cup}...`);
        
        try {
            const result = await crawlCup('http://localhost:3000', cup, season, true);
            
            if (result.success) {
                totalSuccessful++;
                totalNewGames += result.newGames || 0;
                totalUpdatedGames += result.updatedGames || 0;
                totalSkippedPlayed += result.skippedPlayed || 0;
            } else {
                totalFailed++;
            }
            
            await sleep(500);
            
        } catch (error) {
            totalFailed++;
        }
    }
    
    console.log(`\nCrawling abgeschlossen: ${totalSuccessful}/${CURRENT_CUPS.length} erfolgreich`);
    console.log(`Neue: ${totalNewGames}, Aktualisiert: ${totalUpdatedGames}, Übersprungen: ${totalSkippedPlayed}`);
}

/**
 * Crawlt alle Cups für alle Saisons
 */
async function crawlAllSeasons() {
    if (!autoCrawl) {
        console.log('Auto-crawl Modul nicht verfügbar');
        return;
    }

    console.log('Crawling alle Saisons...');
    await autoCrawl.performAutoCrawling();
}

/**
 * Berechnet Bracket-Sortierung für alle Cups der aktuellen Saison
 */
async function calculateBracketSortingForCurrentSeason(season) {
    console.log(`Berechne Bracket-Sortierung für Saison ${season}...`);
    
    try {
        await bracketSorting.addBracketSortOrderColumn(db);
        
        for (let i = 0; i < CURRENT_CUPS.length; i++) {
            const cup = CURRENT_CUPS[i];
            const progress = ((i + 1) / CURRENT_CUPS.length * 100).toFixed(0);
            
            process.stdout.write(`\r[${progress.padStart(3)}%] ${cup}...`);
            
            try {
                await bracketSorting.calculateBracketSortingForEvent(db, cup, season);
            } catch (error) {
                // Fehler ignorieren, Progress fortsetzen
            }
        }
        
        console.log(`\nBracket-Sortierung abgeschlossen`);
        
    } catch (error) {
        console.log(`Bracket-Sortierung fehlgeschlagen: ${error.message}`);
    }
}

/**
 * Berechnet Bracket-Sortierung für alle Saisons
 */
async function calculateBracketSortingForAllSeasons() {
    console.log('Berechne Bracket-Sortierung für alle Saisons...');
    
    try {
        await performBracketCalculation();
        console.log('Bracket-Sortierung für alle Saisons abgeschlossen');
    } catch (error) {
        console.log(`Bracket-Sortierung fehlgeschlagen: ${error.message}`);
    }
}

/**
 * Löscht alle Prognose-Spiele für die aktuelle Saison (Cleanup)
 */
async function cleanupPrognoseGamesForCurrentSeason(season) {
    console.log(`Cleanup Prognose-Spiele für Saison ${season}...`);
    
    try {
        let totalDeleted = 0;
        
        for (let i = 0; i < CURRENT_CUPS.length; i++) {
            const cupType = CURRENT_CUPS[i];
            const progress = ((i + 1) / CURRENT_CUPS.length * 100).toFixed(0);
            
            process.stdout.write(`\r[${progress.padStart(3)}%] ${cupType}...`);
            
            const deleted = await prognoseGames.deleteAllPrognoseGames(db, cupType, season);
            totalDeleted += deleted;
        }
        
        console.log(`\nCleanup abgeschlossen: ${totalDeleted} Prognose-Spiele gelöscht`);
        
    } catch (error) {
        console.log(`Cleanup fehlgeschlagen: ${error.message}`);
    }
}

/**
 * Regeneriert alle Prognose-Spiele für die aktuelle Saison
 */
async function regeneratePrognoseGamesForCurrentSeason(season) {
    console.log(`Generiere Prognose-Spiele für Saison ${season}...`);
    
    try {
        const result = await prognoseGames.generatePrognoseForAllCups(db, season);
        console.log(`Prognose-Spiele abgeschlossen: ${result.totalGenerated} Spiele generiert`);
        
        // Detaillierte Ausgabe pro Cup
        for (const cupResult of result.results) {
            const cupName = getCupDisplayName(cupResult.cupType);
            if (cupResult.error) {
                console.log(`${cupName}: ${cupResult.error}`);
            } else {
                console.log(`${cupName}: ${cupResult.generated || 0} Spiele`);
            }
        }
        
    } catch (error) {
        console.log(`Prognose-Generierung fehlgeschlagen: ${error.message}`);
    }
}

/**
 * Hilfsfunktionen
 */
async function crawlCup(baseUrl, cup, season, skipPlayed = false) {
    const url = `${baseUrl}/crawl-cup?cup=${cup}&season=${encodeURIComponent(season)}${skipPlayed ? '&skipPlayed=true' : ''}`;
    
    const response = await fetch(url, {
        method: 'GET'
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    return result;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getCupDisplayName(cup) {
    const names = {
        'herren_grossfeld': 'Herren Grossfeld',
        'damen_grossfeld': 'Damen Grossfeld', 
        'herren_kleinfeld': 'Herren Kleinfeld',
        'damen_kleinfeld': 'Damen Kleinfeld'
    };
    return names[cup] || cup;
}

/**
 * Quick Update für aktuelle Saison
 */
async function performQuickUpdate() {
    console.log(`Quick Update für Saison ${CURRENT_SEASON}`);
    console.log('='.repeat(50));
    
    // Cleanup Prognose-Spiele (automatisch)
    console.log('1/3: Prognose Cleanup...');
    await cleanupPrognoseGamesForCurrentSeason(CURRENT_SEASON);
    
    // Crawl Cup-Daten
    console.log('\n2/3: Cup-Daten...');
    await crawlCurrentSeason(CURRENT_SEASON);
    
    // Bracket-Sortierung (einmalig)
    console.log('\n3/3: Bracket-Sortierung...');
    await calculateBracketSortingForCurrentSeason(CURRENT_SEASON);
    
    // Prognose-Spiele regenerieren
    console.log('\n4/4: Prognose-Spiele...');
    await regeneratePrognoseGamesForCurrentSeason(CURRENT_SEASON);
    
    console.log(`\nQuick Update für Saison ${CURRENT_SEASON} abgeschlossen`);
    console.log('='.repeat(50));
}

/**
 * Zentrale interaktive Abfrage für alle Crawling-Optionen
 */
async function runInteractiveSetup() {
    console.log('\nSwiss Cup Crawler - Interaktiver Setup');
    console.log('='.repeat(50));
    
    const rl = createReadlineInterface();
    
    try {
        console.log(`Quick Update Option:`);
        console.log(`Aktuelle Saison: ${CURRENT_SEASON}`);
        console.log(`Alle 4 Cups: Herren/Damen Gross-/Kleinfeld`);
        console.log(`Auto-Crawl + Bracket-Sortierung + Prognose-Spiele`);
        
        const quickUpdate = await askQuestion(rl, `Quick Update für ${CURRENT_SEASON}? (y/n): `);
        
        if (quickUpdate === 'y' || quickUpdate === 'yes') {
            rl.close();
            await performQuickUpdate();
            return;
        }
        
        console.log('\nEinzelne Aktionen:');
        console.log('='.repeat(50));
        
        // Prognose-Cleanup (automatisch)
        console.log('Prognose Cleanup (automatisch)...');
        await cleanupPrognoseGamesForCurrentSeason(CURRENT_SEASON);
        
        // Crawling
        const crawlChoice = await askQuestion(rl, 'Cup-Daten crawlen? (a=alle Saisons, y=aktuelle Saison, n=nein): ');
        if (crawlChoice === 'a') {
            await crawlAllSeasons();
        } else if (crawlChoice === 'y' || crawlChoice === 'yes') {
            await crawlCurrentSeason(CURRENT_SEASON);
        }
        
        // Bracket-Sortierung
        const bracketChoice = await askQuestion(rl, 'Bracket-Sortierung? (a=alle Saisons, y=aktuelle Saison, n=nein): ');
        if (bracketChoice === 'a') {
            await calculateBracketSortingForAllSeasons();
        } else if (bracketChoice === 'y' || bracketChoice === 'yes') {
            await calculateBracketSortingForCurrentSeason(CURRENT_SEASON);
        }
        
        // Prognose-Spiele
        const prognoseChoice = await askQuestion(rl, 'Prognose-Spiele für aktuelle Saison generieren? (y/n): ');
        if (prognoseChoice === 'y' || prognoseChoice === 'yes') {
            await regeneratePrognoseGamesForCurrentSeason(CURRENT_SEASON);
        }
        
        console.log('\nSetup abgeschlossen');
        console.log('='.repeat(50));
        
    } catch (error) {
        console.error('Fehler während des interaktiven Setups:', error.message);
    } finally {
        rl.close();
    }
}

/**
 * Führt die Bracket-Sortierung durch
 */
async function performBracketCalculation() {
    try {
        console.log('Berechne Bracket-Sortierung...');
        
        await bracketSorting.addBracketSortOrderColumn(db);
        await bracketSorting.calculateBracketSortingForAll(db);
        
        console.log('Bracket-Sortierung erfolgreich abgeschlossen');
        
    } catch (error) {
        console.log(`Bracket-Sortierung fehlgeschlagen: ${error.message}`);
    }
}

// Server starten
app.listen(PORT, () => {
  console.log('Swiss Cup Crawler läuft auf http://localhost:' + PORT);
  console.log('Unterstützte Cups:');
  console.log('   Mobiliar Cup Herren/Damen Grossfeld');
  console.log('   Liga Cup Herren/Damen Kleinfeld');
  console.log('SQLite Datenbank bereit');
  console.log('API-basiertes Crawling aktiv');
  console.log('Unterstützte Saisons: 2022/23, 2023/24, 2024/25, 2025/26');
  console.log(`Quick Update: Aktuelle Saison ${CURRENT_SEASON}`);
  console.log('Numerische Game IDs werden jetzt erfasst');
  console.log('Bracket-Sortierung verfügbar über API (vereinheitlicht)');
  console.log('Bracket-Module bereinigt - nur bracket-sorting.js aktiv');
  console.log('Prognose-Spiele Modul geladen');
 
  
  // Interaktiver Setup nach kurzer Verzögerung
  setTimeout(() => {
    runInteractiveSetup();
  }, 2000);
});