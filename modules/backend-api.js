// modules/backend-api.js - Backend Interface API Routes

const autoCrawl = require('./auto-crawl');
const bracketSorting = require('./bracket-sorting');
const prognoseGames = require('./prognose-games');

// Aktuelle Saison und Cups
const CURRENT_SEASON = '2025/26';
const CURRENT_CUPS = [
  'herren_grossfeld',
  'damen_grossfeld', 
  'herren_kleinfeld',
  'damen_kleinfeld'
];

/**
 * Registriert alle Backend API Routes
 */
function register(app, db) {
  console.log('🔧 Registriere Backend API Routes...');

  // POST /api/backend/quick-update
  app.post('/api/backend/quick-update', async (req, res) => {
    try {
      console.log(`🚀 Backend API: Quick Update für Saison ${CURRENT_SEASON}`);
      
      const results = {
        prognoseCleanup: 0,
        crawling: { totalNewGames: 0, totalUpdatedGames: 0, totalSuccessful: 0, totalFailed: 0 },
        bracketSorting: false,
        prognoseGeneration: { totalGenerated: 0 }
      };

      // 1. Prognose Cleanup
      console.log('Step 1/4: Prognose Cleanup...');
      for (const cupType of CURRENT_CUPS) {
        const deleted = await prognoseGames.deleteAllPrognoseGames(db, cupType, CURRENT_SEASON);
        results.prognoseCleanup += deleted;
      }

      // 2. Crawling
      console.log('Step 2/4: Cup-Daten crawlen...');
      results.crawling = await crawlCurrentSeason(CURRENT_SEASON);

      // 3. Bracket-Sortierung
      console.log('Step 3/4: Bracket-Sortierung...');
      try {
        await bracketSorting.addBracketSortOrderColumn(db);
        for (const cup of CURRENT_CUPS) {
          await bracketSorting.calculateBracketSortingForEvent(db, cup, CURRENT_SEASON);
        }
        results.bracketSorting = true;
      } catch (error) {
        console.error('Bracket-Sortierung Fehler:', error.message);
      }

      // 4. Prognose-Spiele
      console.log('Step 4/4: Prognose-Spiele...');
      results.prognoseGeneration = await prognoseGames.generatePrognoseForAllCups(db, CURRENT_SEASON);

      res.json({
        success: true,
        message: `Quick Update für ${CURRENT_SEASON} abgeschlossen`,
        summary: `${results.crawling.totalNewGames} neue Spiele, ${results.crawling.totalUpdatedGames} aktualisiert, ${results.prognoseGeneration.totalGenerated} Prognose-Spiele`,
        details: results
      });

    } catch (error) {
      console.error('❌ Quick Update Fehler:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // POST /api/backend/crawl-season
  app.post('/api/backend/crawl-season', async (req, res) => {
    try {
      const { season } = req.body;
      const targetSeason = season || CURRENT_SEASON;
      
      console.log(`📡 Backend API: Crawling Saison ${targetSeason}`);
      
      const results = await crawlCurrentSeason(targetSeason);
      
      res.json({
        success: true,
        season: targetSeason,
        summary: `${results.totalSuccessful}/${CURRENT_CUPS.length} Cups erfolgreich, ${results.totalNewGames} neue Spiele`,
        ...results
      });

    } catch (error) {
      console.error('❌ Crawl Season Fehler:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // POST /api/backend/crawl-all
  app.post('/api/backend/crawl-all', async (req, res) => {
    try {
      console.log('📡 Backend API: Crawling alle Saisons');
      
      const results = await autoCrawl.performAutoCrawling();
      
      res.json({
        success: true,
        summary: `${results.totalSuccessful} Events erfolgreich, ${results.totalNewGames} neue Spiele`,
        ...results
      });

    } catch (error) {
      console.error('❌ Crawl All Fehler:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // POST /api/backend/bracket-season
  app.post('/api/backend/bracket-season', async (req, res) => {
    try {
      const { season } = req.body;
      const targetSeason = season || CURRENT_SEASON;
      
      console.log(`🎯 Backend API: Bracket-Sortierung für Saison ${targetSeason}`);
      
      await bracketSorting.addBracketSortOrderColumn(db);
      
      for (const cup of CURRENT_CUPS) {
        await bracketSorting.calculateBracketSortingForEvent(db, cup, targetSeason);
      }
      
      res.json({
        success: true,
        season: targetSeason,
        message: `Bracket-Sortierung für ${targetSeason} abgeschlossen`
      });

    } catch (error) {
      console.error('❌ Bracket Season Fehler:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // POST /api/backend/bracket-all
  app.post('/api/backend/bracket-all', async (req, res) => {
    try {
      console.log('🎯 Backend API: Bracket-Sortierung für alle Saisons');
      
      await bracketSorting.addBracketSortOrderColumn(db);
      await bracketSorting.calculateBracketSortingForAll(db);
      
      res.json({
        success: true,
        message: 'Bracket-Sortierung für alle Saisons abgeschlossen'
      });

    } catch (error) {
      console.error('❌ Bracket All Fehler:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // POST /api/backend/prognose-cleanup
  app.post('/api/backend/prognose-cleanup', async (req, res) => {
    try {
      console.log(`🗑️ Backend API: Prognose Cleanup für Saison ${CURRENT_SEASON}`);
      
      let totalDeleted = 0;
      for (const cupType of CURRENT_CUPS) {
        const deleted = await prognoseGames.deleteAllPrognoseGames(db, cupType, CURRENT_SEASON);
        totalDeleted += deleted;
      }
      
      res.json({
        success: true,
        deleted: totalDeleted,
        season: CURRENT_SEASON,
        message: `${totalDeleted} Prognose-Spiele gelöscht`
      });

    } catch (error) {
      console.error('❌ Prognose Cleanup Fehler:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // POST /api/backend/prognose-generate
  app.post('/api/backend/prognose-generate', async (req, res) => {
    try {
      console.log(`🔮 Backend API: Prognose-Generierung für Saison ${CURRENT_SEASON}`);
      
      const results = await prognoseGames.generatePrognoseForAllCups(db, CURRENT_SEASON);
      
      res.json({
        success: true,
        generated: results.totalGenerated,
        season: CURRENT_SEASON,
        message: `${results.totalGenerated} Prognose-Spiele generiert`,
        details: results.results
      });

    } catch (error) {
      console.error('❌ Prognose Generate Fehler:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  console.log('✅ Backend API Routes registriert');
}

/**
 * Crawlt alle Cups für eine spezifische Saison
 */
async function crawlCurrentSeason(season) {
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
      console.error(`\nFehler bei ${cup}: ${error.message}`);
    }
  }
  
  console.log(`\nCrawling abgeschlossen: ${totalSuccessful}/${CURRENT_CUPS.length} erfolgreich`);
  console.log(`Neue: ${totalNewGames}, Aktualisiert: ${totalUpdatedGames}, Übersprungen: ${totalSkippedPlayed}`);
  
  return {
    totalSuccessful,
    totalFailed,
    totalNewGames,
    totalUpdatedGames,
    totalSkippedPlayed
  };
}

/**
 * Crawlt einen spezifischen Cup
 */
async function crawlCup(baseUrl, cup, season, skipPlayed = false) {
  const url = `${baseUrl}/crawl-cup?cup=${cup}&season=${encodeURIComponent(season)}${skipPlayed ? '&skipPlayed=true' : ''}`;
  
  const fetch = require('node-fetch');
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

module.exports = {
  register
};