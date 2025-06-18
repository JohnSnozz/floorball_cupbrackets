// modules/auto-crawl.js
// Interaktives Crawling aller Cups ab 2022/23 beim Server-Start

// Node.js 18+ hat fetch eingebaut, kein externes Paket nötig
const readline = require('readline');

// Alle verfügbaren Cups und Saisons
const CUPS = [
    'herren_grossfeld',
    'damen_grossfeld', 
    'herren_kleinfeld',
    'damen_kleinfeld'
];

const SEASONS = [
    '2022/23',
    '2023/24', 
    '2024/25',
    '2025/26'
];

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
 * Führt interaktive Abfragen durch und startet entsprechende Aktionen
 */
async function startInteractiveCrawl(baseUrl = 'http://localhost:3000') {
    console.log('\n🎯 Swiss Cup Crawler - Interaktiver Modus');
    console.log('═'.repeat(50));
    
    const rl = createReadlineInterface();
    
    try {
        // Erste Abfrage: Crawling
        console.log('\n📊 Verfügbare Daten:');
        console.log(`   📅 Saisons: ${SEASONS.join(', ')}`);
        console.log(`   🏒 Cups: ${CUPS.length} verschiedene Cups`);
        console.log(`   📈 Total: ${CUPS.length * SEASONS.length} Events\n`);
        
        const shouldCrawl = await askQuestion(rl, '❓ Soll alles gecrawlt werden? (y/n): ');
        
        let crawlResults = null;
        if (shouldCrawl) {
            console.log('\n🚀 Starte Crawling-Prozess...');
            crawlResults = await performCrawling(baseUrl);
        } else {
            console.log('\n⏭️  Crawling übersprungen');
        }
        
        // Zweite Abfrage: Bracket-Sortierung
        const shouldCalculateBrackets = await askQuestion(rl, '\n❓ Sollen die Brackets berechnet werden? (y/n): ');
        
        if (shouldCalculateBrackets) {
            console.log('\n🎯 Starte Bracket-Sortierung...');
            await performBracketCalculation(baseUrl);
        } else {
            console.log('\n⏭️  Bracket-Berechnung übersprungen');
        }
        
        console.log('\n🎉 Startup-Prozess abgeschlossen!');
        console.log('═'.repeat(50));
        
        if (crawlResults) {
            printCrawlSummary(crawlResults);
        }
        
    } catch (error) {
        console.error('\n❌ Fehler während des interaktiven Prozesses:', error.message);
    } finally {
        rl.close();
    }
}

/**
 * Führt das Crawling für alle Cups und Saisons durch
 */
async function performCrawling(baseUrl) {
    console.log(`\n📋 Crawling von ${CUPS.length * SEASONS.length} Events...`);
    
    let totalSuccessful = 0;
    let totalFailed = 0;
    let totalNewGames = 0;
    let totalCacheGames = 0;
    const results = [];
    
    for (const season of SEASONS) {
        console.log(`\n📅 Season: ${season}`);
        
        for (const cup of CUPS) {
            const cupName = getCupDisplayName(cup);
            process.stdout.write(`  🎯 ${cupName}... `);
            
            try {
                const result = await crawlCup(baseUrl, cup, season);
                
                if (result.success) {
                    console.log(`✅ ${result.newGames} neu, ${result.cacheGames} Cache`);
                    totalSuccessful++;
                    totalNewGames += result.newGames || 0;
                    totalCacheGames += result.cacheGames || 0;
                } else {
                    console.log(`❌ ${result.error}`);
                    totalFailed++;
                }
                
                results.push({
                    cup: cupName,
                    season,
                    ...result
                });
                
                // Kurze Pause zwischen Requests
                await sleep(500);
                
            } catch (error) {
                console.log(`❌ ${error.message}`);
                totalFailed++;
                
                results.push({
                    cup: cupName,
                    season,
                    success: false,
                    error: error.message
                });
            }
        }
    }
    
    console.log(`\n📊 Crawling abgeschlossen:`);
    console.log(`   ✅ Erfolgreich: ${totalSuccessful}/${CUPS.length * SEASONS.length}`);
    console.log(`   ❌ Fehlgeschlagen: ${totalFailed}/${CUPS.length * SEASONS.length}`);
    console.log(`   🆕 Neue Spiele: ${totalNewGames}`);
    console.log(`   💾 Aus Cache: ${totalCacheGames}`);
    
    return {
        totalSuccessful,
        totalFailed,
        totalNewGames,
        totalCacheGames,
        results
    };
}

/**
 * Führt die Bracket-Sortierung durch
 */
async function performBracketCalculation(baseUrl) {
    try {
        console.log('   🔄 Berechne Bracket-Sortierung...');
        
        const result = await calculateBracketSorting(baseUrl);
        
        if (result.success) {
            console.log('   ✅ Bracket-Sortierung erfolgreich abgeschlossen');
        } else {
            console.log(`   ❌ Bracket-Sortierung fehlgeschlagen: ${result.message || 'Unbekannter Fehler'}`);
        }
        
    } catch (error) {
        console.log(`   ❌ Bracket-Sortierung fehlgeschlagen: ${error.message}`);
    }
}

/**
 * Zeigt eine Zusammenfassung der Crawling-Ergebnisse
 */
function printCrawlSummary(crawlResults) {
    console.log('\n📈 Detaillierte Zusammenfassung:');
    
    if (crawlResults.totalNewGames > 0) {
        console.log(`   🆕 ${crawlResults.totalNewGames} neue Spiele gefunden`);
    }
    
    if (crawlResults.totalCacheGames > 0) {
        console.log(`   💾 ${crawlResults.totalCacheGames} Spiele aus Cache geladen`);
    }
    
    if (crawlResults.totalFailed > 0) {
        console.log(`   ⚠️  ${crawlResults.totalFailed} Events konnten nicht geladen werden`);
    }
}

/**
 * Crawlt einen spezifischen Cup
 */
async function crawlCup(baseUrl, cup, season) {
    const url = `${baseUrl}/crawl-cup?cup=${cup}&season=${encodeURIComponent(season)}`;
    
    const response = await fetch(url, {
        method: 'GET'
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    return result;
}

/**
 * Startet Bracket-Sortierung
 */
async function calculateBracketSorting(baseUrl) {
    const url = `${baseUrl}/calculate-bracket-sorting`;
    
    const response = await fetch(url, {
        method: 'POST'
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result;
}

/**
 * Hilfsfunktion: Pause
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Hilfsfunktion: Lesbare Cup-Namen
 */
function getCupDisplayName(cup) {
    const names = {
        'herren_grossfeld': '🏒 Herren Grossfeld',
        'damen_grossfeld': '🏒 Damen Grossfeld', 
        'herren_kleinfeld': '🏑 Herren Kleinfeld',
        'damen_kleinfeld': '🏑 Damen Kleinfeld'
    };
    return names[cup] || cup;
}

/**
 * Prüft ob interaktiver Modus aktiviert werden soll
 */
function shouldRunInteractiveMode() {
    // Interaktiver Modus läuft standardmäßig, außer explizit deaktiviert
    const disabled = process.env.DISABLE_INTERACTIVE_CRAWL === 'true' || 
                    process.env.DISABLE_INTERACTIVE_CRAWL === '1';
    return !disabled;
}

/**
 * Startet interaktiven Modus mit Verzögerung
 */
function initializeInteractiveCrawl(delayMs = 2000) {
    if (!shouldRunInteractiveMode()) {
        console.log('🚫 Interaktiver Crawl-Modus deaktiviert (DISABLE_INTERACTIVE_CRAWL=true)');
        return;
    }
    
    setTimeout(async () => {
        try {
            await startInteractiveCrawl();
        } catch (error) {
            console.error('❌ Interaktiver Crawl-Modus fehlgeschlagen:', error);
        }
    }, delayMs);
}

module.exports = {
    startInteractiveCrawl,
    initializeInteractiveCrawl,
    shouldRunInteractiveMode
};
