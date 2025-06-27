// modules/game-details.js - PostgreSQL Version (funktionell identisch mit SQLite)

const fetch = require('node-fetch');

class GameDetailsManager {
  constructor(db) {
    this.db = db;
    this.setupTable();
  }

  async setupTable() {
    // gamedetails Tabelle für Game Info erstellen - mit season hinzugefügt
    const createTableSQL = `
      create table if not exists gamedetails (
        id serial primary key,
        numericgameid integer unique not null,
        season text,
        home_name text,
        away_name text,
        home_logo text,
        away_logo text,
        result text,
        date text,
        time text,
        location text,
        location_x real,
        location_y real,
        first_referee text,
        second_referee text,
        spectators integer,
        title text,
        subtitle text,
        rawdata text,
        lastupdated timestamp default now()
      )
    `;
        try {
      await this.runAsync(createTableSQL);
      console.log('✅ gamedetails Tabelle bereit (Game Info API)');
      // Check if season column exists, add if not
      await this.addSeasonColumnIfMissing();
    } catch (err) {
      console.error('❌ Fehler beim Erstellen der gamedetails Tabelle:', err);
    }
  }

  async addSeasonColumnIfMissing() {
    try {
      const result = await this.db.query(`
        select exists (
          select from information_schema.columns 
          where table_name = 'gamedetails' and column_name = 'season'
        )
      `);
      
      const hasSeasonColumn = result.rows[0].exists;
      if (!hasSeasonColumn) {
        await this.runAsync("alter table gamedetails add column season text");
        console.log('✅ Season Spalte hinzugefügt');
        // Update existing records with season from games table
        await this.updateExistingSeasons();
      }
    } catch (err) {
      console.error('❌ Fehler beim Prüfen der Tabellen-Info:', err);
    }
  }

  async updateExistingSeasons() {
    const updateSQL = `
      update gamedetails 
      set season = g.season
      from games g
      where gamedetails.numericgameid = g.numericgameid
      and gamedetails.season is null
    `;
    
    try {
      const result = await this.runAsync(updateSQL);
      console.log('✅ Seasons für bestehende gamedetails aktualisiert');
    } catch (err) {
      console.error('❌ Fehler beim Update der Seasons:', err);
    }
  }

  // Date-Parsing Helper (identisch mit SQLite)
  parseDateString(dateStr) {
    if (!dateStr || dateStr.trim() === '') {
      return null;
    }

    // Neue Logik für "heute" und "morgen"
    const today = new Date();
    const lowerDateStr = dateStr.toLowerCase().trim();
    
    if (lowerDateStr === 'heute') {
      const year = today.getFullYear();
      const month = (today.getMonth() + 1).toString().padStart(2, '0');
      const day = today.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    if (lowerDateStr === 'morgen') {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const year = tomorrow.getFullYear();
      const month = (tomorrow.getMonth() + 1).toString().padStart(2, '0');
      const day = tomorrow.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
        if (lowerDateStr === 'gestern') {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const year = tomorrow.getFullYear();
      const month = (tomorrow.getMonth() + 1).toString().padStart(2, '0');
      const day = tomorrow.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // Hauptformat der SwissUnihockey API: DD.MM.YYYY
    const dotFormat = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (dotFormat) {
      const day = parseInt(dotFormat[1]);
      const month = parseInt(dotFormat[2]);
      const year = parseInt(dotFormat[3]);
      
      // Validierung
      if (year >= 1900 && year <= 2100 && 
          month >= 1 && month <= 12 && 
          day >= 1 && day <= 31) {
        
        // Formatiere als YYYY-MM-DD für PostgreSQL
        return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      }
    }

    // Fallback für andere Formate
    const otherFormats = [
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // DD/MM/YYYY  
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/, // YYYY-MM-DD
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // DD-MM-YYYY
    ];

    for (let i = 0; i < otherFormats.length; i++) {
      const match = dateStr.match(otherFormats[i]);
      if (match) {
        let day, month, year;
        
        if (i === 1) { // YYYY-MM-DD
          year = parseInt(match[1]);
          month = parseInt(match[2]);
          day = parseInt(match[3]);
        } else { // DD/MM/YYYY, DD-MM-YYYY
          day = parseInt(match[1]);
          month = parseInt(match[2]);
          year = parseInt(match[3]);
        }

        if (year >= 1900 && year <= 2100 && 
            month >= 1 && month <= 12 && 
            day >= 1 && day <= 31) {
          
          return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        }
      }
    }

    console.warn(`⚠️  Ungültiges Datumsformat: "${dateStr}"`);
    return dateStr; // Original zurückgeben falls Parsing fehlschlägt
  }

  // Time-Parsing Helper (identisch mit SQLite)
  parseTimeString(timeStr) {
    if (!timeStr || timeStr.trim() === '') {
      return null;
    }

    // Mögliche Formate: HH:MM, H:MM, HH.MM
    const timeMatch = timeStr.match(/^(\d{1,2})[:.:](\d{2})$/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
    }

    console.warn(`⚠️  Ungültiges Zeitformat: "${timeStr}"`);
    return timeStr; // Original zurückgeben
  }

  async fetchGameDetails(numericgameid) {
    const url = `https://api-v2.swissunihockey.ch/api/games/${numericgameid}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`❌ Fehler bei gameid ${numericgameid}:`, error.message);
      return null;
    }
  }

  parseGameData(gameData) {
    if (!gameData?.data?.regions?.[0]?.rows?.[0]?.cells) {
      return null;
    }

    const cells = gameData.data.regions[0].rows[0].cells;
    const title = gameData.data.title || '';
    const subtitle = gameData.data.subtitle || '';

    // Rohdaten extrahieren
    const rawDate = cells[5]?.text?.[0] || null;
    const rawTime = cells[6]?.text?.[0] || null;

    // Zellen parsen (entsprechend der Header-Reihenfolge) - IDENTISCH mit SQLite
    const parsed = {
      home_logo: cells[0]?.image?.url || null,
      home_name: cells[1]?.text?.[0] || null,
      away_logo: cells[2]?.image?.url || null,
      away_name: cells[3]?.text?.[0] || null,
      result: cells[4]?.text?.join(' ') || null,
      date: this.parseDateString(rawDate),
      time: this.parseTimeString(rawTime),
      location: cells[7]?.text?.[0] || null,
      location_x: cells[7]?.link?.x || null,
      location_y: cells[7]?.link?.y || null,
      first_referee: cells[8]?.text?.[0] || null,
      second_referee: cells[9]?.text?.[0] || null,
      spectators: cells[10]?.text?.[0] ? parseInt(cells[10].text[0]) : null,
      title,
      subtitle
    };

    return parsed;
  }

  // Promise-Wrapper für PostgreSQL
  async queryAsync(sql, params = []) {
    try {
      const result = await this.db.query(sql, params);
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  async queryAllAsync(sql, params = []) {
    try {
      const result = await this.db.query(sql, params);
      return result.rows || [];
    } catch (error) {
      throw error;
    }
  }

  async runAsync(sql, params = []) {
    try {
      const result = await this.db.query(sql, params);
      return { changes: result.rowCount };
    } catch (error) {
      throw error;
    }
  }

  async saveGameDetails(numericgameid, gameData, season = null) {
    const parsed = this.parseGameData(gameData);
    
    if (!parsed) {
      console.log(`⚠️  Keine verwertbaren Daten für gameid ${numericgameid}`);
      return;
    }
    
  const insertSQL = `
    insert into gamedetails 
    (numericgameid, season, home_name, away_name, home_logo, away_logo, result, 
    date, time, location, location_x, location_y, first_referee, 
    second_referee, spectators, title, subtitle, rawdata, lastupdated)
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, now())
    on conflict (numericgameid) do update set
      season = excluded.season,
      home_name = excluded.home_name,
      away_name = excluded.away_name,
      home_logo = excluded.home_logo,
      away_logo = excluded.away_logo,
      result = excluded.result,
      date = excluded.date,
      time = excluded.time,
      location = excluded.location,
      location_x = excluded.location_x,
      location_y = excluded.location_y,
      first_referee = excluded.first_referee,
      second_referee = excluded.second_referee,
      spectators = excluded.spectators,
      title = excluded.title,
      subtitle = excluded.subtitle,
      rawdata = excluded.rawdata,
      lastupdated = now()
  `;

    try {
      await this.runAsync(insertSQL, [
        parseInt(numericgameid), // Integer conversion
        season,
        parsed.home_name,
        parsed.away_name,
        parsed.home_logo,
        parsed.away_logo,
        parsed.result,
        parsed.date,
        parsed.time,
        parsed.location,
        parsed.location_x,
        parsed.location_y,
        parsed.first_referee,
        parsed.second_referee,
        parsed.spectators,
        parsed.title,
        parsed.subtitle,
        JSON.stringify(gameData)
      ]);
      
      console.log(`✅ Game Details gespeichert: ${parsed.home_name} vs ${parsed.away_name} (${numericgameid}) - Season: ${season}`);
    } catch (error) {
      console.error(`❌ Fehler beim Speichern von gameid ${numericgameid}:`, error);
    }
  }

  // Get available seasons
  async getAvailableSeasons() {
    try {
      const seasonsSQL = `
        select distinct season 
        from games 
        where season is not null 
        order by season desc
      `;
      
      const seasons = await this.queryAllAsync(seasonsSQL);
      return seasons.map(row => row.season);
    } catch (error) {
      console.error('❌ Fehler beim Abrufen der Seasons:', error);
      return [];
    }
  }

// Verwende nur diese Version - lösche die zweite Kopie der Methode
async crawlGameDetailsForSeason(season) {
  console.log(`🔍 Sammle GameIDs für Season ${season}...`);
  
  try {
    // Prüfe ob games Tabelle existiert
    const tableCheck = await this.queryAsync(
      "SELECT to_regclass('games') as exists"
    );
    
    if (!tableCheck?.exists) {
      console.log('⚠️  Games Tabelle existiert nicht - gamedetails Crawling übersprungen');
      return { success: 0, errors: 0 };
    }

    // SQL mit LEFT JOIN: Nur Spiele crawlen die älter als 1 Tag sind oder noch nicht existieren
    const gamesSQL = `
      select distinct g.numericgameid, g.team1, g.team2, g.cuptype, g.season
      from games g
      left join gamedetails gd on g.numericgameid = gd.numericgameid
      where g.numericgameid is not null 
      and lower(g.team1) not like '%freilos%' 
      and lower(g.team2) not like '%freilos%'
      and g.season = $1
      and g.source != 'prognose'
      and (gd.numericgameid is null or gd.lastupdated < now() - interval '1 day')
      order by g.cuptype, g.numericgameid
    `;

    const games = await this.queryAllAsync(gamesSQL, [season]);
    
    if (!games || games.length === 0) {
      console.log(`ℹ️  Keine Games für Season ${season} gefunden oder alle bereits aktuell (< 1 Tag alt)`);
      return { success: 0, errors: 0 };
    }

    console.log(`🎯 Crawle Game Details für ${games.length} Spiele der Season ${season}...`);
    
    let success = 0, errors = 0;

    for (const game of games) {
      const gameData = await this.fetchGameDetails(game.numericgameid);
      
      if (gameData) {
        await this.saveGameDetails(game.numericgameid, gameData, season);
        success++;
        
        // Progress anzeigen
        if (success % 10 === 0) {
          console.log(`📊 Progress Season ${season}: ${success}/${games.length} verarbeitet`);
        }
      } else {
        errors++;
        console.log(`❌ Fehler bei gameid ${game.numericgameid} (${game.team1} vs ${game.team2})`);
      }

      // Rate limiting - 1 Request pro Sekunde
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`📊 Season ${season} Crawling abgeschlossen: ${success} erfolgreich, ${errors} Fehler`);
    return { success, errors, season };
    
  } catch (error) {
    console.error(`❌ Fehler beim Season ${season} Crawling:`, error.message);
    return { success: 0, errors: 1, season };
  }
}

  // Delete gamedetails für spezifische Season
  async deleteGameDetailsForSeason(season) {
    try {
      const deleteSQL = 'delete from gamedetails where season = $1';
      const result = await this.runAsync(deleteSQL, [season]);
      
      console.log(`🗑️ ${result.changes || 0} gamedetails für Season ${season} gelöscht`);
      return { deleted: result.changes || 0, season };
    } catch (error) {
      console.error(`❌ Fehler beim Löschen Season ${season}:`, error.message);
      return { deleted: 0, season, error: error.message };
    }
  }

  

// Legacy: Crawl from all cups - KORRIGIERTE VERSION
async crawlGameDetailsFromCups() {
  console.log('🔍 Sammle GameIDs aus Cup-Daten...');
  
  try {
    const tableCheck = await this.queryAsync(
      "select to_regclass('games') as exists"
    );
    
    if (!tableCheck?.exists) {
      console.log('⚠️  Games Tabelle existiert nicht - gamedetails Crawling übersprungen');
      return { success: 0, errors: 0 };
    }

    // KORRIGIERTE SQL: Entferne numericgameid != '' da Integer nicht leer sein kann
    const gamesSQL = `
      select distinct numericgameid, team1, team2, cuptype, season
      from games 
      where source != 'prognose'
      and numericgameid is not null 
      and numericgameid not in (
        select numericgameid from gamedetails 
        where lastupdated > now() - interval '1 day'
      )
      order by season desc, cuptype, numericgameid
    `;

    const games = await this.queryAllAsync(gamesSQL);
    
    if (!games || games.length === 0) {
      console.log('ℹ️  Alle echten Games bereits aktuell oder keine neuen Cup-Games mit numericgameid vorhanden');
      return { success: 0, errors: 0 };
    }

    console.log(`🎯 Crawle Game Details für ${games.length} echte Cup-Spiele...`);
    
    let success = 0, errors = 0;

    for (const game of games) {
      const gameData = await this.fetchGameDetails(game.numericgameid);
      
      if (gameData) {
        await this.saveGameDetails(game.numericgameid, gameData, game.season);
        success++;
        
        if (success % 10 === 0) {
          console.log(`📊 Progress: ${success}/${games.length} verarbeitet`);
        }
      } else {
        errors++;
        console.log(`❌ Fehler bei gameid ${game.numericgameid} (${game.team1} vs ${game.team2})`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`📊 Game Details Crawling abgeschlossen: ${success} erfolgreich, ${errors} Fehler`);
    return { success, errors };
    
  } catch (error) {
    console.error('❌ Fehler beim Game Details Crawling:', error.message);
    return { success: 0, errors: 1 };
  }
}

  async getGameDetailsStats() {
    const statsSQL = `
      select 
        count(*) as totalgames,
        count(case when result is not null and result != '' then 1 end) as gameswithresults,
        count(case when spectators is not null and spectators > 0 then 1 end) as gameswithspectators,
        avg(case when spectators is not null and spectators > 0 then spectators end) as avgspectators,
        count(case when first_referee is not null and first_referee != '' then 1 end) as gameswithreferees
      from gamedetails
    `;
    
    try {
      return await this.queryAsync(statsSQL);
    } catch (error) {
      console.error('❌ Fehler beim Abrufen der Stats:', error);
      return { totalgames: 0, gameswithresults: 0, gameswithspectators: 0, avgspectators: 0, gameswithreferees: 0 };
    }
  }

  async getSeasonStats() {
    const seasonStatsSQL = `
      select 
        season,
        count(*) as totalgames,
        count(case when result is not null and result != '' then 1 end) as gameswithresults,
        max(lastupdated) as lastupdate
      from gamedetails 
      where season is not null
      group by season 
      order by season desc
    `;
    
    try {
      return await this.queryAllAsync(seasonStatsSQL);
    } catch (error) {
      console.error('❌ Fehler beim Abrufen der Season Stats:', error);
      return [];
    }
  }
}

module.exports = {
  GameDetailsManager,
  
  initialize: (db) => {
    return new GameDetailsManager(db);
  },

  register: (app, db) => {
    const manager = new GameDetailsManager(db);

    // Game Details für einzelnes Spiel
    app.get('/api/game-details/:gameid', async (req, res) => {
      try {
        const result = await manager.queryAsync(
          'select * from gamedetails where numericgameid = $1', 
          [parseInt(req.params.gameid)]
        );
        
        if (result && result.rawdata) {
          result.rawdata = JSON.parse(result.rawdata);
        }
        
        res.json(result || { error: 'Game not found' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Game Details Statistiken
    app.get('/api/game-details/stats', async (req, res) => {
      try {
        const stats = await manager.getGameDetailsStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Season Statistics
    app.get('/api/game-details/season-stats', async (req, res) => {
      try {
        const seasonStats = await manager.getSeasonStats();
        res.json(seasonStats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Available Seasons
    app.get('/api/game-details/seasons', async (req, res) => {
      try {
        const seasons = await manager.getAvailableSeasons();
        res.json(seasons);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Manual crawl trigger (alle Seasons)
    app.post('/api/crawl-game-details', async (req, res) => {
      try {
        const result = await manager.crawlGameDetailsFromCups();
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Crawl für spezifische Season
    app.post('/api/crawl-game-details/:season', async (req, res) => {
      try {
        const season = req.params.season;
        const result = await manager.crawlGameDetailsForSeason(season);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Delete gamedetails für Season
    app.delete('/api/game-details/season/:season', async (req, res) => {
      try {
        const season = req.params.season;
        const result = await manager.deleteGameDetailsForSeason(season);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Alle Game Details auflisten (mit Season-Filter)
    app.get('/api/game-details', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const season = req.query.season;
        
        let sql = `
          select numericgameid, season, home_name, away_name, result, date, time, 
                 location, spectators, title, subtitle, lastupdated
          from gamedetails 
        `;
        
        let params = [];
        
        if (season) {
          sql += ' where season = $1 ';
          params.push(season);
        }
        
        sql += ' order by lastupdated desc ';
        
        if (limit > 0) {
          sql += ` limit ${params.length + 1} offset ${params.length + 2} `;
          params.push(limit, offset);
        }
        
        const result = await manager.queryAllAsync(sql, params);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    console.log('🎯 gamedetails API-Routes mit Season-Management registriert');
  }
};