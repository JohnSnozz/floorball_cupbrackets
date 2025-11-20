# AWS Deployment Guide - Floorball Cup Brackets

Schritt-für-Schritt Anleitung zur Deployment auf einem AWS Server (Ubuntu/Debian).

## Voraussetzungen

- AWS EC2 Instance (Ubuntu 20.04/22.04 oder Debian 11/12)
- SSH-Zugang zum Server
- Domain oder öffentliche IP-Adresse (optional)

---

## 1. Server vorbereiten (SSH Terminal)

### Mit Server verbinden
```bash
ssh -i your-key.pem ubuntu@your-server-ip
```

### System aktualisieren
```bash
sudo apt update
sudo apt upgrade -y
```

---

## 2. Node.js und Bun installieren

### Node.js installieren (für bcrypt dependencies)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Sollte v20.x zeigen
```

### Bun installieren
```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version  # Verifizieren
```

---

## 3. PostgreSQL installieren und konfigurieren

### PostgreSQL installieren
```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Datenbank und Benutzer erstellen
```bash
sudo -u postgres psql
```

In der PostgreSQL-Konsole:
```sql
-- Datenbank erstellen
CREATE DATABASE floorball_cupbrackets;

-- Benutzer erstellen
CREATE USER floorball_user WITH PASSWORD 'IHR_SICHERES_DB_PASSWORT_HIER';

-- Berechtigungen erteilen
GRANT ALL PRIVILEGES ON DATABASE floorball_cupbrackets TO floorball_user;

-- PostgreSQL verlassen
\q
```

### PostgreSQL für lokale Verbindungen konfigurieren
```bash
# Peer-Authentifizierung auf md5 ändern (falls nötig)
sudo nano /etc/postgresql/*/main/pg_hba.conf
```

Stelle sicher, dass diese Zeile existiert:
```
local   all             all                                     md5
```

PostgreSQL neu starten:
```bash
sudo systemctl restart postgresql
```

---

## 4. Datenbank-Schema (wird automatisch erstellt)

### Verbindung testen (optional)
```bash
psql -U floorball_user -d floorball_cupbrackets -h localhost
# Passwort eingeben wenn gefragt
# \q zum Verlassen
```

**Wichtig**: Das Datenbank-Schema wird automatisch beim ersten App-Start erstellt!

Die App (`modules/database.js`) erstellt automatisch:
- ✅ Die `games` Tabelle mit allen Spalten
- ✅ Alle notwendigen Indizes für Performance
- ✅ Migriert fehlende Spalten falls Schema-Updates vorhanden sind

Sie müssen **keine** SQL-Datei manuell importieren!

---

## 5. Git Repository klonen

### Git installieren (falls nicht vorhanden)
```bash
sudo apt install -y git
```

### Repository klonen
```bash
cd ~
git clone https://github.com/IHR_USERNAME/IHR_REPO_NAME.git floorball_cupbrackets
cd floorball_cupbrackets
```

**WICHTIG**: Ersetzen Sie `IHR_USERNAME/IHR_REPO_NAME` mit Ihrem tatsächlichen Repository!

---

## 6. Umgebungsvariablen konfigurieren

### .env Datei erstellen
```bash
nano .env
```

Folgenden Inhalt einfügen (Werte anpassen!):
```env
# PostgreSQL Verbindung
DB_USER=floorball_user
DB_PASSWORD=IHR_SICHERES_DB_PASSWORT_HIER
DB_HOST=localhost
DB_PORT=5432
DB_NAME=floorball_cupbrackets

# Session Secret (64 Zeichen zufällig)
SESSION_SECRET=GENERIEREN_SIE_EINEN_ZUFÄLLIGEN_64_ZEICHEN_STRING

# Admin Login (bcrypt Hashes)
ADMIN_USERNAME_HASH=$2b$12$GENERIERTER_USERNAME_HASH
ADMIN_PASSWORD_HASH=$2b$12$GENERIERTER_PASSWORD_HASH

# Server Port
PORT=3000
```

**Session Secret generieren**:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Admin-Hashes generieren**:
```bash
# Zuerst in generate-hashes.js Ihr gewünschtes Passwort eintragen
nano generate-hashes.js
# Ändern Sie Zeile 9: const password = 'IHR_ADMIN_PASSWORT';

# Dann ausführen:
bun run generate-hashes.js

# Kopieren Sie die generierten Hashes in die .env Datei
```

---

## 7. Abhängigkeiten installieren

```bash
bun install
```

---

## 8. Anwendung testen

```bash
bun start
```

Sollte ausgeben:
```
🚀 Server läuft auf http://localhost:3000
📊 PostgreSQL verbunden
```

Test in einem anderen Terminal:
```bash
curl http://localhost:3000
```

Mit `Ctrl+C` stoppen.

---

## 9. Prozess-Management (wählen Sie eine Methode)

### Option A: PM2 (empfohlen für Entwicklung)

PM2 hält die App am Laufen und startet sie automatisch nach Server-Neustart.

```bash
# PM2 installieren
npm install -g pm2

# App mit PM2 starten
pm2 start "bun start" --name floorball-app
pm2 save
pm2 startup
# Folgen Sie den Anweisungen die PM2 ausgibt!
```

**PM2 Befehle**:
```bash
pm2 status              # Status anzeigen
pm2 logs floorball-app  # Logs anzeigen
pm2 restart floorball-app  # Neu starten
pm2 stop floorball-app  # Stoppen
```

### Option B: systemd Service (empfohlen für Produktion)

Native Linux-Systemd-Integration (kein PM2 notwendig).

```bash
# Service-Datei bearbeiten (Pfade anpassen!)
nano floorball-app.service
# Ändern Sie /home/ubuntu/floorball_cupbrackets zu Ihrem tatsächlichen Pfad

# Service installieren
sudo cp floorball-app.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable floorball-app
sudo systemctl start floorball-app
```

**systemd Befehle**:
```bash
sudo systemctl status floorball-app      # Status
sudo systemctl restart floorball-app     # Neu starten
sudo systemctl stop floorball-app        # Stoppen
sudo journalctl -u floorball-app -f      # Logs
```

---

## 10. Nginx als Reverse Proxy (Optional aber empfohlen)

### Nginx installieren
```bash
sudo apt install -y nginx
```

### Nginx konfigurieren
```bash
sudo nano /etc/nginx/sites-available/floorball
```

Folgende Konfiguration einfügen:
```nginx
server {
    listen 80;
    server_name your-domain.com;  # Oder Ihre IP-Adresse

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Nginx aktivieren
```bash
sudo ln -s /etc/nginx/sites-available/floorball /etc/nginx/sites-enabled/
sudo nginx -t  # Konfiguration testen
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## 11. Firewall konfigurieren

```bash
# UFW Firewall aktivieren
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS (für später mit SSL)
sudo ufw enable
sudo ufw status
```

---

## 12. SSL-Zertifikat mit Let's Encrypt (Optional)

Falls Sie eine Domain haben:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Folgen Sie den Anweisungen. Certbot konfiguriert automatisch Nginx für HTTPS.

---

## 13. Deployment abgeschlossen!

Ihre Anwendung läuft jetzt auf:
- **Mit Nginx**: `http://your-domain.com` oder `http://your-server-ip`
- **Ohne Nginx**: `http://your-server-ip:3000`

### Backend-Dashboard Zugriff
```
http://your-domain.com/dev/login
```

---

## Wartung und Updates

### Code aktualisieren
```bash
cd ~/floorball_cupbrackets
git pull
bun install  # Falls neue Dependencies
pm2 restart floorball-app
```

### Logs anzeigen
```bash
pm2 logs floorball-app
```

### Datenbank Backup
```bash
pg_dump -U floorball_user -d floorball_cupbrackets > backup_$(date +%Y%m%d).sql
```

### Datenbank Restore
```bash
psql -U floorball_user -d floorball_cupbrackets < backup_20250120.sql
```

---

## Troubleshooting

### App startet nicht
```bash
pm2 logs floorball-app  # Fehler prüfen
```

### Datenbank-Verbindungsfehler
```bash
# PostgreSQL läuft?
sudo systemctl status postgresql

# Verbindung testen
psql -U floorball_user -d floorball_cupbrackets -h localhost
```

### Port bereits belegt
```bash
sudo lsof -i :3000  # Welcher Prozess nutzt Port 3000?
```

### Nginx Fehler
```bash
sudo nginx -t  # Konfiguration testen
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
```

---

## Schnell-Referenz: Alle Befehle in Reihenfolge

```bash
# 1. System Update
sudo apt update && sudo apt upgrade -y

# 2. Node.js und Bun
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# 3. PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 4. Datenbank erstellen
sudo -u postgres psql -c "CREATE DATABASE floorball_cupbrackets;"
sudo -u postgres psql -c "CREATE USER floorball_user WITH PASSWORD 'IHR_PASSWORT';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE floorball_cupbrackets TO floorball_user;"

# 5. Repository klonen
cd ~
git clone https://github.com/IHR_USERNAME/IHR_REPO.git floorball_cupbrackets
cd floorball_cupbrackets

# 6. .env erstellen und konfigurieren
nano .env
# (Werte eintragen wie oben beschrieben)

# 7. Hashes generieren
nano generate-hashes.js  # Passwort ändern
bun run generate-hashes.js
# Hashes in .env kopieren

# 8. Dependencies installieren
bun install

# 9. PM2 installieren und starten
npm install -g pm2
pm2 start "bun start" --name floorball-app
pm2 save
pm2 startup

# 10. Nginx (optional)
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/floorball
# (Konfiguration einfügen)
sudo ln -s /etc/nginx/sites-available/floorball /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# 11. Firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw enable

# Fertig!
```

---

## Support

Bei Problemen prüfen Sie:
1. PM2 Logs: `pm2 logs floorball-app`
2. Nginx Logs: `sudo tail -f /var/log/nginx/error.log`
3. PostgreSQL Status: `sudo systemctl status postgresql`
4. .env Datei korrekt konfiguriert
