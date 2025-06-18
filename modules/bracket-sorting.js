// Bracket-Sortierungs-Logik für Swiss Cup
// --------------------------------------------------------------
// Diese Version implementiert exakt den vom User beschriebenen
// Rückwärts-Sortier-Algorithmus (Basisrunde → frühere Runden)
// incl. sauberem Freilos-Handling.
//
// Schritte
// 1. Bestimme die höchste bereits erfasste Runde (am nächsten zum
//    Finale) und sortiere sie strikt nach `numericGameId`. Jedes Spiel
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
//    Runde mehrere „Freilos vs Freilos“-Partien, werden sie in der
//    aufsteigenden Reihenfolge ihrer `numericGameId` genutzt.
// --------------------------------------------------------------

/* eslint-disable no-console */
const sqlite3 = require('sqlite3').verbose();

// --------------------------------------------------------------
//            🔧  Hilfsfunktionen
// --------------------------------------------------------------
function getUnifiedRoundPriority(roundName) {
  const name = (roundName || '').toLowerCase().trim();
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
//            📥  Low-Level Datenbank-Helfer
// --------------------------------------------------------------
function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err); else resolve(this);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}

// --------------------------------------------------------------
//            🧠  Kerne-Algorithmus
// --------------------------------------------------------------
async function calculateBracketSortingForEvent(db, cupType, season) {
  console.log(`\n🏒  Bracket-Sorting für ${cupType} – ${season}`);

  // 1️⃣  Alle unterschiedlichen Runden holen & nach Priorität sortieren (Finale ➜ erste Stelle)
  const roundRows = await all(
    db,
    'SELECT DISTINCT roundName FROM games WHERE cupType = ? AND season = ?;',
    [cupType, season]
  );
  if (roundRows.length === 0) {
    console.warn('⚠️  Keine Spiele vorhanden – übersprungen.');
    return;
  }
  roundRows.sort((a, b) => getUnifiedRoundPriority(b.roundName) - getUnifiedRoundPriority(a.roundName));
  const orderedRoundNames = roundRows.map((r) => r.roundName);

  // 2️⃣  Basisrunde bestimmen (= erste Runde in orderedRoundNames)
  const baseRound = orderedRoundNames[0];
  console.log(`🎯  Basisrunde (höchste gespielte Runde): ${baseRound}`);

  await sortRoundByNumericGameId(db, cupType, season, baseRound);

  // 3️⃣  Rückwärts alle weiteren Runden sortieren
  for (let i = 1; i < orderedRoundNames.length; i += 1) {
    const currentRound = orderedRoundNames[i];
    const nextRound = orderedRoundNames[i - 1]; // bereits sortiert
    await sortRoundBasedOnNextRound(db, cupType, season, currentRound, nextRound);
  }

  console.log('✅  Bracket-Sorting abgeschlossen');
}

// --------------------------------------------------------------
//            🔄  Runden-Sortierung
// --------------------------------------------------------------
async function sortRoundByNumericGameId(db, cupType, season, roundName) {
  console.log(`   ➜ Sortiere ${roundName} nach numericGameId …`);
  const games = await all(
    db,
    `SELECT gameId, numericGameId FROM games WHERE cupType = ? AND season = ? AND roundName = ? ORDER BY CAST(numericGameId AS INTEGER) ASC;`,
    [cupType, season, roundName]
  );
  for (let idx = 0; idx < games.length; idx += 1) {
    await run(db, 'UPDATE games SET bracketSortOrder = ? WHERE gameId = ?;', [idx + 1, games[idx].gameId]);
  }
}

// --------------------------------------------------------------
//   🗺️  Hilfsfunktion: Team-Liste der „nächsten“ Runde erzeugen
// --------------------------------------------------------------
async function buildTeamOrder(db, cupType, season, nextRoundName) {
  const nextRoundGames = await all(
    db,
    `SELECT team1, team2 FROM games WHERE cupType = ? AND season = ? AND roundName = ? ORDER BY bracketSortOrder ASC;`,
    [cupType, season, nextRoundName]
  );
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
async function sortRoundBasedOnNextRound(db, cupType, season, currentRoundName, nextRoundName) {
  console.log(`   ➜ Sortiere ${currentRoundName} auf Basis von ${nextRoundName}`);

  // 1. Team-Liste der nächsten Runde in korrekter Bracket-Reihenfolge
  const teamOrder = await buildTeamOrder(db, cupType, season, nextRoundName);

  // 2. Spiele der aktuellen Runde einlesen & in Maps aufteilen
  const currentGames = await all(
    db,
    `SELECT gameId, numericGameId, team1, team2 FROM games WHERE cupType = ? AND season = ? AND roundName = ? ORDER BY CAST(numericGameId AS INTEGER) ASC;`,
    [cupType, season, currentRoundName]
  );

  const teamToGame = new Map();
  const freilosGames = [];
  currentGames.forEach((g) => {
   if (isFreilos(g.team1) && isFreilos(g.team2)) {
  freilosGames.push(g); // wirklich nur Freilos vs Freilos
} else {
  if (g.team1 && !isFreilos(g.team1)) teamToGame.set(g.team1, g);
  if (g.team2 && !isFreilos(g.team2)) teamToGame.set(g.team2, g);
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
      while (freilosPtr < freilosGames.length && usedGameIds.has(freilosGames[freilosPtr].gameId)) {
        freilosPtr += 1;
      }
      if (freilosPtr < freilosGames.length) {
        game = freilosGames[freilosPtr];
        freilosPtr += 1;
      }
    } else {
      game = teamToGame.get(t);
    }

    if (game && !usedGameIds.has(game.gameId)) {
      sortedGames.push(game);
      usedGameIds.add(game.gameId);
    }
  }

  // 4. Fallback – übriggebliebene Spiele anhängen (sollte idR leer sein)
  currentGames.forEach((g) => {
    if (!usedGameIds.has(g.gameId)) {
      sortedGames.push(g);
      usedGameIds.add(g.gameId);
    }
  });

  // 5. Persistiere bracketSortOrder
  for (let i = 0; i < sortedGames.length; i += 1) {
    await run(db, 'UPDATE games SET bracketSortOrder = ? WHERE gameId = ?;', [i + 1, sortedGames[i].gameId]);
  }
  console.log(`      ↳ ${sortedGames.length} Spiele sortiert (davon ${freilosGames.length} mit Freilos)`);
}

// --------------------------------------------------------------
//            🏗️  DB-Vorbereitung & Exporte
// --------------------------------------------------------------
async function addBracketSortOrderColumn(db) {
  try {
    await run(db, 'ALTER TABLE games ADD COLUMN bracketSortOrder INTEGER DEFAULT NULL;');
    console.log('ℹ️  Spalte bracketSortOrder hinzugefügt');
  } catch (err) {
    if (err.message && err.message.toLowerCase().includes('duplicate')) {
      console.log('ℹ️  Spalte bracketSortOrder existiert bereits');
    } else {
      throw err;
    }
  }
}

async function calculateBracketSortingForAll(db) {
  const events = await all(db, 'SELECT DISTINCT cupType, season FROM games;');
  for (const e of events) {
    await calculateBracketSortingForEvent(db, e.cupType, e.season);
  }
}

module.exports = {
  // öffentliche API – genutzt von server.js & bracket-routes.js
  calculateBracketSortingForAll,
  calculateBracketSortingForEvent,
  addBracketSortOrderColumn,

  // teilweise an anderer Stelle genutzt (Tests …)
  getUnifiedRoundPriority,
  isFreilos,
  isFreilosGame,
};
