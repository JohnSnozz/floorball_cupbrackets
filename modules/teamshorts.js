/**
 * modules/teamshorts.js
 * Dieses Modul synchronisiert die Tabelle 'teamshorts' mit einer CSV-Datei.
 * Wenn nötig, wird die Tabelle erstellt.
 */

const fs = require('fs');
const path = require('path');
const { initialize } = require('./database');

// Hole den Connection Pool aus database.js und initialisiere die Datenbank
const pool = initialize();

/**
 * Überprüft, ob die Tabelle 'teamshorts' existiert, und erstellt sie bei Bedarf.
 */
async function ensureTable() {
  console.log('🔧 Überprüfe Tabelle `teamshorts`...');
  const result = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'teamshorts'
    );
  `);

  if (!result.rows[0].exists) {
    console.log('🆕 Erstelle Tabelle `teamshorts`...');
    await pool.query(`
      CREATE TABLE teamshorts (
        team VARCHAR(255) PRIMARY KEY,
        teamshort VARCHAR(255) NOT NULL
      );
    `);
    console.log('✅ Tabelle `teamshorts` erstellt');
  } else {
    console.log('ℹ️ Tabelle `teamshorts` existiert bereits');
  }
}

/**
 * Liest die CSV-Datei ein und synchronisiert deren Inhalt mit der Tabelle.
 * @param {Buffer} csvBuffer - Inhalt der CSV-Datei
 */
async function syncCSVBuffer(csvBuffer) {
  console.log('📥 Lese CSV-Datei aus Buffer');
  const content = csvBuffer.toString('utf8').replace(/^\uFEFF/, '');
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  const [, ...rows] = lines; // erste Zeile ist Header

  for (const line of rows) {
    const [team, teamshort] = line.split(';').map(cell => cell.trim());
    if (!team) continue;
    await pool.query(
      `INSERT INTO teamshorts (team, teamshort)
       VALUES ($1, $2)
       ON CONFLICT (team) DO UPDATE
       SET teamshort = EXCLUDED.teamshort
       WHERE teamshorts.teamshort <> EXCLUDED.teamshort;`,
      [team, teamshort]
    );
  }
  console.log('✅ CSV-Synchronisation abgeschlossen');
}

/**
 * Express Route Handler: CSV-Upload verarbeiten
 */
function registerRoutes(app) {
  const multer = require('multer');
  const upload = multer();

  app.post('/api/backend/teamshorts-sync', upload.single('csv'), async (req, res) => {
    try {
      await ensureTable();
      await syncCSVBuffer(req.file.buffer);
      res.json({ success: true });
    } catch (err) {
      console.error('❌ Fehler beim Verarbeiten der CSV:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
}

module.exports = { registerRoutes };
