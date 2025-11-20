// modules/util-routes.js - Utility-Routen (Health, Clear, Static)

const path = require('path');
const fs = require('fs');
const multer = require('multer');
const auth = require('./auth');

// Teamshorts Integration
const upload = multer();

function register(app, pool) {  // ← pool statt db
  console.log('🔧 Registriere Utility-Routen...');

  // GET /health - Health Check
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version
    });
  });

  // GET /calculate-bracket-sorting - Bracket-Sortierung berechnen
  app.get('/calculate-bracket-sorting', async (req, res) => {
    try {
      console.log('🧮 Starting bracket sorting calculation...');
      
      // Importiere die Bracket-Logik
      const bracketSorting = require('./bracket-sorting');
      await bracketSorting.addBracketSortOrderColumn(pool);  // ← pool
      await bracketSorting.calculateBracketSortingForAll(pool);  // ← pool
      
      console.log('✅ Bracket sorting calculation completed');
      res.json({ success: true, message: 'Bracket sorting calculated' });
    } catch (error) {
      console.error('❌ Error calculating bracket sorting:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // ========== TEAMSHORTS MANAGEMENT ==========
  
  // Hilfsfunktion: Teamshorts Tabelle erstellen
  async function ensureTeamshortsTable() {
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

  // Hilfsfunktion: CSV synchronisieren
  async function syncCSVBuffer(csvBuffer) {
    console.log('📥 Lese CSV-Datei aus Buffer');
    const content = csvBuffer.toString('utf8').replace(/^\uFEFF/, '');
    const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
    const [, ...rows] = lines; // erste Zeile ist Header

    let updated = 0;
    let inserted = 0;

    for (const line of rows) {
      const [team, teamshort] = line.split(';').map(cell => cell.trim());
      if (!team) continue;
      
      const result = await pool.query(
        `INSERT INTO teamshorts (team, teamshort)
         VALUES ($1, $2)
         ON CONFLICT (team) DO UPDATE
         SET teamshort = EXCLUDED.teamshort
         WHERE teamshorts.teamshort <> EXCLUDED.teamshort
         RETURNING (xmax = 0) AS inserted;`,
        [team, teamshort]
      );
      
      if (result.rows.length > 0) {
        if (result.rows[0].inserted) {
          inserted++;
        } else {
          updated++;
        }
      }
    }
    
    console.log(`✅ CSV-Synchronisation abgeschlossen: ${inserted} neue, ${updated} aktualisiert`);
    return { updated, inserted };
  }

  // POST /api/backend/teamshorts-sync - CSV Upload & Sync (geschützt)
  app.post('/api/backend/teamshorts-sync', auth.requireAuth, upload.single('csv'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Keine CSV-Datei hochgeladen' });
      }

      await ensureTeamshortsTable();
      const result = await syncCSVBuffer(req.file.buffer);

      res.json({
        success: true,
        updated: result.updated,
        inserted: result.inserted,
        message: `${result.inserted} neue Teams, ${result.updated} aktualisiert`
      });

    } catch (err) {
      console.error('❌ Fehler beim Verarbeiten der CSV:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/teamshorts - Alle Teamshorts abrufen (geschützt)
  app.get('/api/teamshorts', auth.requireAuth, async (req, res) => {
    try {
      await ensureTeamshortsTable();
      const result = await pool.query('SELECT team, teamshort FROM teamshorts ORDER BY team ASC');
      res.json({ success: true, teamshorts: result.rows });
    } catch (err) {
      console.error('❌ Fehler beim Abrufen der Teamshorts:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/teamshorts - Neues Team hinzufügen (geschützt)
  app.post('/api/teamshorts', auth.requireAuth, async (req, res) => {
    try {
      const { team, teamshort } = req.body;

      if (!team || !teamshort) {
        return res.status(400).json({ success: false, error: 'Team und Teamshort sind erforderlich' });
      }

      await ensureTeamshortsTable();
      await pool.query(
        `INSERT INTO teamshorts (team, teamshort)
         VALUES ($1, $2)
         ON CONFLICT (team) DO UPDATE
         SET teamshort = EXCLUDED.teamshort`,
        [team, teamshort]
      );

      res.json({ success: true, message: 'Team erfolgreich hinzugefügt' });
    } catch (err) {
      console.error('❌ Fehler beim Hinzufügen:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/teamshorts/update-multiple - Multiple Teams updaten (geschützt)
  app.post('/api/teamshorts/update-multiple', auth.requireAuth, async (req, res) => {
    try {
      const { updates } = req.body;

      if (!updates || !Array.isArray(updates)) {
        return res.status(400).json({ success: false, error: 'Updates-Array erforderlich' });
      }

      await ensureTeamshortsTable();

      for (const update of updates) {
        const { team, teamshort } = update;
        if (team) {
          await pool.query(
            `UPDATE teamshorts SET teamshort = $1 WHERE team = $2`,
            [teamshort || '', team]
          );
        }
      }

      res.json({ success: true, message: `${updates.length} Team(s) aktualisiert` });
    } catch (err) {
      console.error('❌ Fehler beim Update:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // DELETE /api/teamshorts/:team - Team löschen (geschützt)
  app.delete('/api/teamshorts/:team', auth.requireAuth, async (req, res) => {
    try {
      const team = decodeURIComponent(req.params.team);

      await ensureTeamshortsTable();
      await pool.query('DELETE FROM teamshorts WHERE team = $1', [team]);

      res.json({ success: true, message: 'Team erfolgreich gelöscht' });
    } catch (err) {
      console.error('❌ Fehler beim Löschen:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ========== ÖFFENTLICHE ROUTEN (ohne Auth) ==========
  
  // GET / - Hauptseite
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  // GET /bracket - Bracket-Seite
  app.get('/bracket', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'bracket.html'));
  });

  // GET /dbreview - Datenbank-Review-Seite (öffentlich)
  app.get('/dbreview', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'dbreview.html'));
  });

  // ========== GESCHÜTZTE DEV-ROUTEN ==========
  
  // GET /dev/ - Backend Dashboard (geschützt)
  app.get('/dev/', auth.requireAuth, (req, res) => {
    // Lade das Backend Dashboard HTML aus einer separaten Datei
    const dashboardPath = path.join(__dirname, '..', 'public', 'backend-dashboard.html');
    
    // Prüfe ob die Datei existiert, falls nicht, zeige Fallback
    if (fs.existsSync(dashboardPath)) {
      res.sendFile(dashboardPath);
    } else {
      // Fallback: Minimales Dashboard falls Datei nicht existiert
      res.send(`
        <!DOCTYPE html>
        <html lang="de">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>🔧 Backend Dashboard</title>
            <style>
              body { font-family: system-ui; background: #1a1a1a; color: #fff; padding: 2rem; }
              .container { max-width: 800px; margin: 0 auto; }
              .card { background: #2a2a2a; padding: 2rem; border-radius: 8px; margin: 1rem 0; }
              .btn { background: #007bff; color: white; padding: 0.5rem 1rem; text-decoration: none; border-radius: 4px; margin: 0.5rem; display: inline-block; }
              .btn-danger { background: #dc3545; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🔧 Backend Dashboard</h1>
                
                <div class="card">
                    <h3>📁 Dateien fehlen</h3>
                    <p>Die Backend-Dashboard-Dateien wurden nicht gefunden. Bitte erstellen Sie:</p>
                    <ul>
                        <li><code>public/backend-dashboard.html</code></li>
                        <li><code>public/backend-dashboard.css</code></li>
                        <li><code>public/backend-functions.js</code></li>
                    </ul>
                </div>
                
                <div class="card">
                    <h3>🔗 Verfügbare Links</h3>
                    <a href="/dev/dbreview.html" class="btn">📊 DB Review</a>
                    <a href="/dev/gamedetails.html" class="btn">🎮 Game Details</a>
                    <a href="/bracket" class="btn">🏆 Bracket View</a>
                    <a href="/health" class="btn">❤️ Health Check</a>
                    <button class="btn btn-danger" onclick="logout()">🚪 Logout</button>
                </div>
            </div>
            
            <script>
              async function logout() {
                if (confirm('Wirklich ausloggen?')) {
                  await fetch('/dev/logout', { method: 'POST' });
                  window.location.href = '/dev/login';
                }
              }
            </script>
        </body>
        </html>
      `);
    }
  });

  // Statische Dateien für Backend Dashboard bereitstellen
  app.get('/backend-dashboard.css', (req, res) => {
    const cssPath = path.join(__dirname, '..', 'public', 'backend-dashboard.css');
    if (fs.existsSync(cssPath)) {
      res.sendFile(cssPath);
    } else {
      res.status(404).send('/* backend-dashboard.css not found */');
    }
  });

  app.get('/backend-functions.js', (req, res) => {
    const jsPath = path.join(__dirname, '..', 'public', 'backend-functions.js');
    if (fs.existsSync(jsPath)) {
      res.sendFile(jsPath);
    } else {
      res.status(404).send('// backend-functions.js not found');
    }
  });

  // GET /dev/dbreview.html - Datenbank-Review-Seite (geschützt)
  app.get('/dev/dbreview.html', auth.requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'dbreview.html'));
  });

  // GET /dev/gamedetails.html - GameDetails-Review-Seite (geschützt)
  app.get('/dev/gamedetails.html', auth.requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'gamedetails.html'));
  });

  console.log('✅ Utility-Routen (inkl. Teamshorts Management) registriert');
}

module.exports = {
  register
};