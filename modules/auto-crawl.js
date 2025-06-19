// modules/auto-crawl.js
// Crawling-Logik OHNE Benutzerabfragen (wird von server.js gesteuert)

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
 * Führt das Crawling für alle Cups und Saisons durch
 */
async function performAutoCrawling(baseUrl = 'http://localhost:3000') {
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

module.exports = {
    performAutoCrawling,
    CUPS,
    SEASONS
};