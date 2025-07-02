# Swiss Cup Crawler

PostgreSQL-basierte Anwendung zum Crawlen und Verwalten von Swiss Unihockey Cup-Daten.

## Struktur

### Hauptdatei
- **`server.js`** - Express-Server mit Middleware-Konfiguration und Route-Registrierung

### Module (`modules/`)

#### 🔧 Core System
- **`database.js`** - PostgreSQL Connection Pool und Schema-Management
- **`middleware.js`** - Express-Middleware (Body Parser, CORS, Logging, Error Handling)
- **`auth.js`** - Backend-Authentifizierung mit bcrypt und Rate Limiting

#### 📡 Data Crawling
- **`cup-routes.js`** - Crawlt Cup-Daten von Swiss Unihockey API mit Smart Skip Logic
- **`auto-crawl.js`** - Automatisches Crawling aller Cups und Saisons ohne User Input
- **`game-details.js`** - Crawlt detaillierte Spiel-Informationen (Schiedsrichter, Zuschauer, etc.)
- **`game-events.js`** - Crawlt Spiel-Events (Tore, Strafen, beste Spieler)

#### 🏆 Tournament Logic
- **`bracket-sorting.js`** - Rückwärts-Sortierung von Cup-Brackets (finale → erste Runde)
- **`prognose-games.js`** - Generiert Prognose-Spiele basierend auf aktueller Bracket-Situation

#### 🌐 API & Routes
- **`game-routes.js`** - API-Routen für Spiel-Daten und Statistiken
- **`api-routes.js`** - Frontend-API (Seasons, Cups, Stats)
- **`util-routes.js`** - Utility-Routen (Health Check, Teamshorts Management)
- **`bracket-routes.js`** - API-Routen für Bracket-Sortierung
- **`backend-api.js`** - Geschützte Backend-API (Quick Update, Batch Operations)

#### 📊 Data Management
- **`teamshorts.js`** - CSV-basierte Verwaltung von Team-Kurznamen

## Features

✅ **API-basiertes Crawling** von Swiss Unihockey Cup-Daten  
✅ **Smart Skip Logic** - überspringt bereits gespielte Spiele  
✅ **Bracket-Sortierung** mit intelligentem Rückwärts-Algorithmus  
✅ **Prognose-Spiele** bis 1/8 Final (danach Losung)  
✅ **PostgreSQL** mit Connection Pooling und Auto-Schema  
✅ **Backend-Auth** mit Session Management  
✅ **Rate Limiting** für API-Schutz  
✅ **Season Management** für alle Module  

## Unterstützte Daten

- **Cups**: Herren/Damen Grossfeld/Kleinfeld
- **Saisons**: 2022/23, 2023/24, 2024/25, 2025/26
- **Spiel-Details**: Datum, Zeit, Ort, Schiedsrichter, Zuschauer
- **Events**: Tore, Strafen, beste Spieler pro Spiel

## Frontend Files (`public/`)

#### 🎨 Styling
- **`fullscreen-bracket.css`** - Hauptstyles für Vollbild-Bracket-Ansicht
- **`team_highlight.css`** - Team-Highlighting beim Hover
- **`smart-match-link.css`** - Info-Links zu Spieldetails
- **`smart-connector.css`** - Verbindungslinien zwischen Bracket-Runden
- **`bottom-controls.css`** - Bottom-Right Controls für Cup/Season/Zoom
- **`backend-dashboard.css`** - Backend-Dashboard Styling

#### 🎮 JavaScript Modules
- **`smartbracket.js`** - Haupt-Bracket-Logik, lädt und rendert Cup-Daten
- **`fullscreen-interaction.js`** - Zoom/Pan-Funktionalität für Vollbild-Ansicht
- **`team_highlight.js`** - Team-Highlighting über alle Runden
- **`smart-match-link.js`** - Spieldetails-Integration mit DB-Tooltips
- **`smart-connector.js`** - Zeichnet Verbindungslinien zwischen Bracket-Runden
- **`bottom-controls.js`** - Bottom-Right Controls (Cup-Auswahl, Zoom)
- **`backend-functions.js`** - Backend-Dashboard Funktionen

#### 📄 HTML Templates
- **`index.html`** - Haupt-Bracket-Interface (Vollbild mit Controls)
- **`backend-dashboard.html`** - Backend-Management-Interface

## Features im Detail

### 🏆 Smart Bracket System
- **Absolute Positionierung** mit automatischer Größenberechnung
- **Rückwärts-Sortierung** (Finale → erste Runde) mit intelligentem Positioning
- **Freilos-Behandlung** mit visueller Kennzeichnung
- **Responsive Team-Namen** mit dynamischer Schriftgrößenanpassung
- **Hover-Highlighting** aller Team-Instanzen bracket-weit

### 🎮 Interaktive Funktionen  
- **Vollbild-Ansicht** mit freiem Zoom/Pan (0.2x - 3.0x)
- **Smart Match Links** mit Datenbank-Tooltips (Datum, Zeit, Schiedsrichter, etc.)
- **Bottom Controls** für Cup/Season-Wechsel und Zoom-Steuerung
- **Keyboard Shortcuts** (F=Auto-fit, 0=Center, +/-=Zoom, 1-4=Cup-Auswahl)

### 🔗 Smart Connectors
- **Automatische Verbindungslinien** zwischen aufeinanderfolgenden Runden
- **Bracket-basierte Geometrie** folgt der tatsächlichen Spiel-Hierarchie  
- **Hover-Integration** mit Team-Highlighting

### 📱 Responsive Design
- **Mobile-optimiert** mit Touch-Gesten
- **Adaptive Schriftgrößen** je nach Team-Namen-Länge
- **Flexible Controls** passen sich an Bildschirmgröße an

## Schnellstart

1. `.env` mit PostgreSQL-Credentials erstellen
2. `npm start` - Server startet auf Port 3000
3. `/bracket` für öffentliche Bracket-Ansicht (Vollbild)
4. `/dev/` für Backend-Dashboard (Auth erforderlich)