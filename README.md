# Swiss Floorball Cup Brackets

Ein Web-Crawler und Bracket-Generator für die Schweizer Floorball Cup-Wettbewerbe (Mobiliar Cup und Liga Cup).

## Features

### 🏆 Cup-Management
- **4 Cup-Wettbewerbe**: Mobiliar Cup Herren/Damen Grossfeld, Liga Cup Herren/Damen Kleinfeld
- **Automatisches Crawling**: Daten von Swiss Unihockey API
- **Bracket-Sortierung**: Intelligente Sortierung der K.O.-Spiele
- **Prognose-Spiele**: Automatische Generierung von Platzhalter-Spielen für zukünftige Runden
- **Multi-Season Support**: Verwaltung mehrerer Saisons (2022/23 bis 2025/26)

### 📊 Game Details & Events
- **Game Details**: Spielinfo (Schiedsrichter, Zuschauer, Spielort)
- **Game Events**: Spielereignisse (Tore, Strafen, Torschützen)
- **Robustes Retry-Crawling**: Automatische Wiederholungsversuche bei Fehlern
- **Season-basiertes Crawling**: Gezieltes Crawling einzelner Saisons

### 🎨 Frontend
- **Responsive Bracket-Ansicht**: Moderne, mobile-freundliche Darstellung
- **Live-Updates**: Automatische Aktualisierung der Spielstände
- **Team-Filter**: Suche nach spezifischen Teams
- **Darkmode**: Modernes dunkles Design

### 🔧 Backend-Dashboard
- **Geschützter Admin-Bereich**: Session-basierte Authentifizierung
- **Crawling-Steuerung**: Manuelle Steuerung aller Crawl-Operationen
- **Quick Update**: Schnelles Update der aktuellen Saison
- **Bracket-Management**: Berechnung und Reset der Bracket-Sortierung
- **Prognose-Management**: Generierung und Verwaltung von Prognose-Spielen
- **Teamshorts-Manager**: Visuelle Verwaltung von Team-Abkürzungen
- **Season-Verwaltung**: Komplette Löschung einzelner Saisons

## Tech Stack

- **Runtime**: Bun (schneller JavaScript-Runtime)
- **Backend**: Node.js/Express
- **Datenbank**: PostgreSQL
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Web Scraping**: Puppeteer (headless Chrome)
- **API**: Swiss Unihockey REST API

## Installation

### Voraussetzungen

- Bun (1.0.0 oder höher)
- PostgreSQL (14.0 oder höher)
- Git

### Setup

1. **Repository klonen**
   ```bash
   git clone <repository-url>
   cd floorball_cupbrackets
   ```

2. **Dependencies installieren**
   ```bash
   bun install
   ```

3. **PostgreSQL-Datenbank erstellen**
   ```bash
   createdb floorball_cups
   createuser floorball_user
   ```

4. **Umgebungsvariablen konfigurieren**

   Erstelle eine `.env`-Datei im Root-Verzeichnis:
   ```env
   # Datenbank
   DB_USER=floorball_user
   DB_HOST=localhost
   DB_NAME=floorball_cups
   DB_PASSWORD=your_password
   DB_PORT=5432

   # Session
   SESSION_SECRET=your_random_session_secret

   # Admin-Zugangsdaten (bcrypt-Hashes)
   ADMIN_USERNAME_HASH=$2b$10$...
   ADMIN_PASSWORD_HASH=$2b$10$...

   # Server
   PORT=3000
   ```

5. **Admin-Hashes generieren**
   ```bash
   bun run generate-hashes.js
   ```
   Kopiere die generierten Hashes in die `.env`-Datei.

6. **Server starten**
   ```bash
   bun start
   ```

   Der Server läuft auf: http://localhost:3000

## Verwendung

### Frontend
- **Hauptseite**: http://localhost:3000
- **Bracket-Ansicht**: http://localhost:3000/bracket

### Backend-Dashboard
- **Login**: http://localhost:3000/dev/
- **Teamshorts-Manager**: http://localhost:3000/teamshorts-manager.html

### API-Endpoints

#### Öffentliche Endpoints
- `GET /api/cups` - Alle Cups abrufen
- `GET /api/cups/:id` - Spezifischen Cup abrufen
- `GET /api/seasons` - Alle Saisons abrufen
- `GET /api/games` - Alle Spiele abrufen (mit Filtern)
- `GET /api/game-details/:gameId` - Game Details für ein Spiel
- `GET /api/game-events/:gameId` - Game Events für ein Spiel

#### Geschützte Endpoints (benötigen Authentifizierung)
- `POST /api/backend/crawl/:season` - Season crawlen
- `POST /api/backend/quick-update` - Quick Update
- `POST /api/crawl-game-details/:season` - Game Details crawlen
- `POST /api/crawl-game-details/:season/retry` - Robustes Retry-Crawling
- `POST /api/crawl-game-events/:season` - Game Events crawlen
- `POST /api/backend/bracket-sorting/:season` - Bracket-Sortierung berechnen
- `POST /api/backend/generate-prognose/:season` - Prognose-Spiele generieren
- `GET /api/teamshorts` - Teamshorts abrufen
- `POST /api/teamshorts` - Teamshort hinzufügen
- `POST /api/teamshorts/update-multiple` - Multiple Teamshorts aktualisieren
- `DELETE /api/teamshorts/:team` - Teamshort löschen

## Entwicklung

### Projekt-Struktur

```
floorball_cupbrackets/
├── server.js                 # Haupt-Server-Datei
├── package.json             # Projektabhängigkeiten
├── .env                     # Umgebungsvariablen (nicht versioniert)
├── modules/                 # Backend-Module
│   ├── database.js          # Datenbankverbindung
│   ├── auth.js              # Authentifizierung
│   ├── cup-routes.js        # Cup-API-Routen
│   ├── game-routes.js       # Game-API-Routen
│   ├── game-details.js      # Game Details Crawling
│   ├── game-events.js       # Game Events Crawling
│   ├── bracket-sorting.js   # Bracket-Sortierung
│   ├── prognose-games.js    # Prognose-Spiele
│   ├── util-routes.js       # Utility-Routen (inkl. Teamshorts)
│   ├── backend-api.js       # Backend-API-Routen
│   └── middleware.js        # Express-Middleware
├── public/                  # Frontend-Dateien
│   ├── index.html           # Hauptseite
│   ├── bracket.html         # Bracket-Ansicht
│   ├── backend-dashboard.html  # Admin-Dashboard
│   ├── teamshorts-manager.html # Teamshorts-Manager
│   ├── *.css                # Stylesheets
│   └── *.js                 # Frontend-JavaScript
└── archive/                 # Archivierte Dateien (nicht versioniert)
    ├── fix-scripts/         # Alte Fix-Scripts
    ├── backup/              # Backups
    ├── BUN_MIGRATION.md     # Migrations-Dokumentation
    └── DEVELOPMENT_NOTES.md # Entwicklungsnotizen
```

### Scripts

```bash
# Produktion
bun start              # Server starten

# Entwicklung
bun run dev            # Server mit Auto-Reload

# Utilities
bun run generate-hashes.js  # Admin-Hashes generieren
```

### Bun-Migration

Das Projekt wurde von npm auf Bun migriert für bessere Performance. Details siehe `archive/BUN_MIGRATION.md`.

**Reverting zu npm** (falls nötig):
```bash
# Bun-Dateien entfernen
rm bun.lockb
rm -rf .bun

# npm-Backup wiederherstellen
cp archive/backup/npm-backup/package.json .
cp archive/backup/npm-backup/package-lock.json .

# npm installieren
npm install

# Server mit Node.js starten
npm run start:npm
```

## Datenbank-Schema

### Tabellen
- **cups**: Cup-Informationen (id, name, gender, fieldtype, season)
- **games**: Spielinformationen (id, cupid, gamedate, hometeam, awayteam, result, etc.)
- **gamedetails**: Erweiterte Spielinfo (gameid, first_referee, spectators, etc.)
- **gameevents**: Spielereignisse (gameid, eventtype, minute, player, etc.)
- **teamshorts**: Team-Abkürzungen (team, teamshort)

## Features im Detail

### Bracket-Sortierung
- Intelligente Sortierung der K.O.-Spiele
- Berücksichtigt Spielebene, Datum und Spielnummer
- Sortiert Final, Halbfinal, Viertelfinal, etc.

### Prognose-Spiele
- Automatische Generierung von Platzhalter-Spielen
- Basierend auf aktuellen Spielergebnissen
- "n.V." (noch verfügbar) und "n.P." (noch zu platzieren) Marker

### Teamshorts-Manager
- Visuelle Bearbeitung von Team-Abkürzungen
- Inline-Editing mit direkter Speicherung
- Suchfunktion und Bulk-Updates
- CSV-Import/Export

## Troubleshooting

### Server startet nicht
- Prüfe ob PostgreSQL läuft: `pg_isready`
- Prüfe Umgebungsvariablen in `.env`
- Prüfe Port-Verfügbarkeit: `lsof -i :3000`

### Crawling-Fehler
- Verwende "Robustes Retry-Crawling" im Backend
- Prüfe Internetverbindung
- Swiss Unihockey API könnte temporär nicht verfügbar sein

### Login funktioniert nicht
- Generiere neue Admin-Hashes mit `generate-hashes.js`
- Prüfe SESSION_SECRET in `.env`
- Lösche Browser-Cookies und versuche erneut

## License

Privates Projekt - Alle Rechte vorbehalten

## Autor

Jonas

## Version

**Aktuelle Version**: Bun-Migration mit Teamshorts-Manager
**Datum**: November 2025
