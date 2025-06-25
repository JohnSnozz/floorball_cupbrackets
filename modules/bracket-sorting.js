// Bracket-Sortierungs-Logik für Swiss Cup (PostgreSQL)
// --------------------------------------------------------------
// Diese Version implementiert exakt den vom User beschriebenen
// Rückwärts-Sortier-Algorithmus (Basisrunde → frühere Runden)
// incl. sauberem Freilos-Handling.
//
// Schritte
// 1. Bestimme die höchste bereits erfasste Runde (am nächsten zum
//    Finale) und sortiere sie strikt nach `numericgameid`. Jedes Spiel
//    erhält dabei den `bracketSortOrder` 1 … N.
// 2. Baue aus dieser Basisrunde eine Team-Liste in genau dieser
//    Reihenfolge (Heimteam, Auswärtsteam). Jedes Team erhält implizit
//    eine Positions-Nummer 1 … 2N.
// 3. Gehe nun Runde für Runde zurück. Für jede vorherige Runde wird
//    der erste noch unbelegte Eintrag der Team-Liste gesucht und das
//    dazugehörige Spiel an die Ergebnisliste angehängt. So erhält jedes
//    Spiel der älteren Runde die richtige `bracketSortOrder`.
// 4. Spiele mit Freilos werden dabei an jener Position einsortiert, an
//    der der Freilos-Platz in der Team-Liste erscheint. Enthält eine
//    Runde mehrere „Freilos vs Freilos"-Partien, werden sie in der
//    aufsteigenden Reihenfolge ihrer `numericgameid` genutzt.
// --------------------------------------------------------------

/* eslint-disable no-console */

// Diese Variable wird in der initialize() Funktion gesetzt
let pool = null;

// --------------------------------------------------------------
//            🔧  Hilfsfunktionen
// --------------------------------------------------------------
function getUnifiedRoundPriority(roundname) {
  const name = (roundname || '').toLowerCase().trim();
  const fraction = name.match(/^1\/(\d+)$/);
  if (fraction) {
    const denom = parseInt(fraction[1], 10);
    return Math.log2(128) - Math.log2(denom) + 1; // 1/128 ➜ 1, 1/1 ➜ 8
  }
  return 1000;
}

function isFreilos(team) {
  return (team || '').toLowerCase() === 'freilos';
}

function isFreilosGame(game) {
  return isFreilos(game.team1) || isFreilos(game.team2);
}

// --------------------------------------------------------------
//            🧠  Kerne-Algorithmus
// --------------------------------------------------------------
async function calculateBracketSortingForEvent(poolordb, cuptype, season) {
  console.log(`\n🏒  Bracket-Sorting für ${cuptype} – ${season}`);

  // Bestimme ob wir PostgreSQL Pool oder SQLite DB verwenden
  const isPostgreSQL = poolordb.query !== undefined;
  
  // 1️⃣  Alle unterschiedlichen Runden holen & nach Priorität sortieren (Finale ➜ erste Stelle)
  let roundRows;
  
  if (isPostgreSQL) {
    const result = await poolordb.query(
      'SELECT DISTINCT roundname FROM games WHERE cuptype = $1 AND season = $2',
      [cuptype, season]
    );
    roundRows = result.rows;
  } else {
    // SQLite Fallback (falls noch verwendet)
    roundRows = await new Promise((resolve, reject) => {
      poolordb.all(
        'SELECT DISTINCT roundname FROM games WHERE cuptype = ? AND season = ?',
        [cuptype, season],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
  
  if (roundRows.length === 0) {
    console.warn('⚠️  Keine Spiele vorhanden – übersprungen.');
    return;
  }
  
  roundRows.sort((a, b) => getUnifiedRoundPriority(b.roundname || b.roundname) - getUnifiedRoundPriority(a.roundname || a.roundname));
  const orderedRoundNames = roundRows.map((r) => r.roundname || r.roundname);

  // 2️⃣  Basisrunde bestimmen (= erste Runde in orderedRoundNames)
  const baseRound = orderedRoundNames[0];
  console.log(`🎯  Basisrunde (höchste gespielte Runde): ${baseRound}`);

  await sortRoundByNumericGameId(poolordb, cuptype, season, baseRound, isPostgreSQL);

  // 3️⃣  Rückwärts alle weiteren Runden sortieren
  for (let i = 1; i < orderedRoundNames.length; i += 1) {
    const currentRound = orderedRoundNames[i];
    const nextRound = orderedRoundNames[i - 1]; // bereits sortiert
    await sortRoundBasedOnNextRound(poolordb, cuptype, season, currentRound, nextRound, isPostgreSQL);
  }

  console.log('✅  Bracket-Sorting abgeschlossen');
}

// --------------------------------------------------------------
//            🔄  Runden-Sortierung
// --------------------------------------------------------------
async function sortRoundByNumericGameId(poolordb, cuptype, season, roundname, isPostgreSQL) {
  console.log(`   ➜ Sortiere ${roundname} nach numericgameid …`);
  
  let games;
  
  if (isPostgreSQL) {
    const result = await poolordb.query(
      `SELECT gameid, numericgameid FROM games WHERE cuptype = $1 AND season = $2 AND roundname = $3 ORDER BY CAST(numericgameid AS INTEGER) ASC`,
      [cuptype, season, roundname]
    );
    games = result.rows;
  } else {
    // SQLite Fallback
    games = await new Promise((resolve, reject) => {
      poolordb.all(
        `SELECT gameid, numericgameid FROM games WHERE cuptype = ? AND season = ? AND roundname = ? ORDER BY CAST(numericgameid AS INTEGER) ASC`,
        [cuptype, season, roundname],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
  
  for (let idx = 0; idx < games.length; idx += 1) {
    if (isPostgreSQL) {
      await poolordb.query(
        'UPDATE games SET bracketsortorder = $1 WHERE gameid = $2',
        [idx + 1, games[idx].gameid || games[idx].gameid]
      );
    } else {
      // SQLite Fallback
      await new Promise((resolve, reject) => {
        poolordb.run(
          'UPDATE games SET bracketsortorder = ? WHERE gameid = ?',
          [idx + 1, games[idx].gameid],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
  }
}

// --------------------------------------------------------------
//   🗺️  Hilfsfunktion: Team-Liste der „nächsten" Runde erzeugen
// --------------------------------------------------------------
async function buildTeamOrder(poolordb, cuptype, season, nextroundname, isPostgreSQL) {
  let nextRoundGames;
  
  if (isPostgreSQL) {
    const result = await poolordb.query(
      `SELECT team1, team2 FROM games WHERE cuptype = $1 AND season = $2 AND roundname = $3 ORDER BY bracketsortorder ASC`,
      [cuptype, season, nextroundname]
    );
    nextRoundGames = result.rows;
  } else {
    // SQLite Fallback
    nextRoundGames = await new Promise((resolve, reject) => {
      poolordb.all(
        `SELECT team1, team2 FROM games WHERE cuptype = ? AND season = ? AND roundname = ? ORDER BY bracketsortorder ASC`,
        [cuptype, season, nextroundname],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
  
  const list = [];
  nextRoundGames.forEach((g) => {
    list.push(g.team1 || 'freilos');
    list.push(g.team2 || 'freilos');
  });
  return list; // Länge = 2 * Spiele der nächsten Runde
}

// --------------------------------------------------------------
//            🔗  Sortierung auf Basis der nächsten Runde
// --------------------------------------------------------------
async function sortRoundBasedOnNextRound(poolordb, cuptype, season, currentroundname, nextroundname, isPostgreSQL) {
  console.log(`   ➜ Sortiere ${currentroundname} auf Basis von ${nextroundname}`);

  // 1. Team-Liste der nächsten Runde in korrekter Bracket-Reihenfolge
  const teamOrder = await buildTeamOrder(poolordb, cuptype, season, nextroundname, isPostgreSQL);

  // 2. Spiele der aktuellen Runde einlesen & in Maps aufteilen
  let currentGames;
  
  if (isPostgreSQL) {
    const result = await poolordb.query(
      `SELECT gameid, numericgameid, team1, team2 FROM games WHERE cuptype = $1 AND season = $2 AND roundname = $3 ORDER BY CAST(numericgameid AS INTEGER) ASC`,
      [cuptype, season, currentroundname]
    );
    currentGames = result.rows;
  } else {
    // SQLite Fallback
    currentGames = await new Promise((resolve, reject) => {
      poolordb.all(
        `SELECT gameid, numericgameid, team1, team2 FROM games WHERE cuptype = ? AND season = ? AND roundname = ? ORDER BY CAST(numericgameid AS INTEGER) ASC`,
        [cuptype, season, currentroundname],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  const teamToGame = new Map();
  const freilosGames = [];
  
  currentGames.forEach((g) => {
    // Normalisiere Feldnamen (PostgreSQL gibt lowercase zurück)
    const game = {
      gameid: g.gameid || g.gameid,
      numericgameid: g.numericgameid || g.numericgameid,
      team1: g.team1,
      team2: g.team2
    };
    
    if (isFreilos(game.team1) && isFreilos(game.team2)) {
      freilosGames.push(game); // wirklich nur Freilos vs Freilos
    } else {
      if (game.team1 && !isFreilos(game.team1)) teamToGame.set(game.team1, game);
      if (game.team2 && !isFreilos(game.team2)) teamToGame.set(game.team2, game);
    }
  });

  const usedGameIds = new Set();
  const sortedGames = [];
  let freilosPtr = 0;

  // 3. Iteration über die Team-Liste → Spiel-Liste erzeugen
  for (const t of teamOrder) {
    let game = null;

    if (isFreilos(t)) {
      // Einen Freilos-vs-Freilos-Match oder Freilos-Match wählen
      while (freilosPtr < freilosGames.length && usedGameIds.has(freilosGames[freilosPtr].gameid)) {
        freilosPtr += 1;
      }
      if (freilosPtr < freilosGames.length) {
        game = freilosGames[freilosPtr];
        freilosPtr += 1;
      }
    } else {
      game = teamToGame.get(t);
    }

    if (game && !usedGameIds.has(game.gameid)) {
      sortedGames.push(game);
      usedGameIds.add(game.gameid);
    }
  }

  // 4. Fallback – übriggebliebene Spiele anhängen (sollte idR leer sein)
  currentGames.forEach((g) => {
    const gameid = g.gameid || g.gameid;
    if (!usedGameIds.has(gameid)) {
      sortedGames.push({
        gameid: gameid,
        numericgameid: g.numericgameid || g.numericgameid,
        team1: g.team1,
        team2: g.team2
      });
      usedGameIds.add(gameid);
    }
  });

  // 5. Persistiere bracketSortOrder
  for (let i = 0; i < sortedGames.length; i += 1) {
    if (isPostgreSQL) {
      await poolordb.query(
        'UPDATE games SET bracketsortorder = $1 WHERE gameid = $2',
        [i + 1, sortedGames[i].gameid]
      );
    } else {
      // SQLite Fallback
      await new Promise((resolve, reject) => {
        poolordb.run(
          'UPDATE games SET bracketsortorder = ? WHERE gameid = ?',
          [i + 1, sortedGames[i].gameid],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
  }
  
  console.log(`      ↳ ${sortedGames.length} Spiele sortiert (davon ${freilosGames.length} mit Freilos)`);
}

// --------------------------------------------------------------
//            🏗️  DB-Vorbereitung & Exporte
// --------------------------------------------------------------
async function addBracketSortOrderColumn(poolordb) {
  const isPostgreSQL = poolordb.query !== undefined;
  
  try {
    if (isPostgreSQL) {
      // Prüfe ob Spalte bereits existiert
      const columnExists = await poolordb.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'games' AND column_name = 'bracketsortorder'
        );
      `);
      
      if (!columnExists.rows[0].exists) {
        await poolordb.query('ALTER TABLE games ADD COLUMN bracketsortorder INTEGER DEFAULT NULL');
        console.log('ℹ️  Spalte bracketsortorder hinzugefügt');
      } else {
        console.log('ℹ️  Spalte bracketsortorder existiert bereits');
      }
    } else {
      // SQLite Fallback
      await new Promise((resolve, reject) => {
        poolordb.run('ALTER TABLE games ADD COLUMN bracketsortorder INTEGER DEFAULT NULL', (err) => {
          if (err) {
            if (err.message && err.message.toLowerCase().includes('duplicate')) {
              console.log('ℹ️  Spalte bracketsortorder existiert bereits');
              resolve();
            } else {
              reject(err);
            }
          } else {
            console.log('ℹ️  Spalte bracketsortorder hinzugefügt');
            resolve();
          }
        });
      });
    }
  } catch (err) {
    if (err.message && err.message.toLowerCase().includes('duplicate')) {
      console.log('ℹ️  Spalte bracketsortorder existiert bereits');
    } else {
      throw err;
    }
  }
}

async function calculateBracketSortingForAll(poolordb) {
  const isPostgreSQL = poolordb.query !== undefined;
  let events;
  
  if (isPostgreSQL) {
    const result = await poolordb.query('SELECT DISTINCT cuptype, season FROM games');
    events = result.rows;
  } else {
    // SQLite Fallback
    events = await new Promise((resolve, reject) => {
      poolordb.all('SELECT DISTINCT cuptype, season FROM games', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
  
  for (const e of events) {
    const cuptype = e.cuptype || e.cuptype;
    const season = e.season;
    await calculateBracketSortingForEvent(poolordb, cuptype, season);
  }
}

// Initialisiere Pool-Referenz für Verwendung in anderen Modulen
function setPool(poolInstance) {
  pool = poolInstance;
}

// Wrapper-Funktionen für Kompatibilität mit bestehenden Modulen
async function run(poolordb, sql, params = []) {
  const isPostgreSQL = poolordb.query !== undefined;
  
  if (isPostgreSQL) {
    // Konvertiere SQL von SQLite zu PostgreSQL Format
    let pgSql = sql;
    let pgParams = params;
    
    // Konvertiere ? Parameter zu $1, $2, etc.
    if (params.length > 0) {
      let paramIndex = 1;
      pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
    }
    
    const result = await poolordb.query(pgSql, pgParams);
    return { changes: result.rowCount || 0 };
  } else {
    // SQLite Fallback
    return new Promise((resolve, reject) => {
      poolordb.run(sql, params, function (err) {
        if (err) reject(err); 
        else resolve({ changes: this.changes || 0 });
      });
    });
  }
}

async function all(poolordb, sql, params = []) {
  const isPostgreSQL = poolordb.query !== undefined;
  
  if (isPostgreSQL) {
    // Konvertiere SQL von SQLite zu PostgreSQL Format
    let pgSql = sql;
    let pgParams = params;
    
    // Konvertiere ? Parameter zu $1, $2, etc.
    if (params.length > 0) {
      let paramIndex = 1;
      pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
    }
    
    const result = await poolordb.query(pgSql, pgParams);
    return result.rows;
  } else {
    // SQLite Fallback
    return new Promise((resolve, reject) => {
      poolordb.all(sql, params, (err, rows) => {
        if (err) reject(err); 
        else resolve(rows);
      });
    });
  }
}

async function get(poolordb, sql, params = []) {
  const isPostgreSQL = poolordb.query !== undefined;
  
  if (isPostgreSQL) {
    // Konvertiere SQL von SQLite zu PostgreSQL Format
    let pgSql = sql;
    let pgParams = params;
    
    // Konvertiere ? Parameter zu $1, $2, etc.
    if (params.length > 0) {
      let paramIndex = 1;
      pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
    }
    
    const result = await poolordb.query(pgSql, pgParams);
    return result.rows[0] || null;
  } else {
    // SQLite Fallback
    return new Promise((resolve, reject) => {
      poolordb.get(sql, params, (err, row) => {
        if (err) reject(err); 
        else resolve(row);
      });
    });
  }
}

module.exports = {
  // öffentliche API – genutzt von server.js & bracket-routes.js
  calculateBracketSortingForAll,
  calculateBracketSortingForEvent,
  addBracketSortOrderColumn,
  setPool,

  // teilweise an anderer Stelle genutzt (Tests …)
  getUnifiedRoundPriority,
  isFreilos,
  isFreilosGame,
  
  // Helper-Funktionen für Kompatibilität
  run,
  all,
  get
};