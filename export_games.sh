#!/bin/bash

# export_games.sh - Exportiert die games Tabelle aus PostgreSQL als CSV
# 
# Usage: ./export_games.sh [output_filename]
# 
# Beispiele:
#   ./export_games.sh                          # Standard: games_YYYY-MM-DD.csv
#   ./export_games.sh my_games.csv            # Custom filename
#   ./export_games.sh /path/to/games.csv      # Mit Pfad

# Farbcodes für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 PostgreSQL Games Export${NC}"
echo "================================"

# Lade .env Datei falls vorhanden
if [ -f .env ]; then
    echo -e "${BLUE}📄 Lade .env Konfiguration...${NC}"
    export $(grep -v '^#' .env | xargs)
else
    echo -e "${YELLOW}⚠️  .env Datei nicht gefunden - verwende Standard-Werte${NC}"
fi

# Datenbank-Konfiguration aus Umgebungsvariablen
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-swisscup}
DB_USER=${DB_USER:-postgres}
# DB_PASSWORD wird über PGPASSWORD gesetzt

# Output-Datei bestimmen
if [ -n "$1" ]; then
    OUTPUT_FILE="$1"
else
    TIMESTAMP=$(date +"%Y-%m-%d")
    OUTPUT_FILE="games_${TIMESTAMP}.csv"
fi

echo -e "${BLUE}📊 Datenbank:${NC} ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo -e "${BLUE}📁 Output:${NC} ${OUTPUT_FILE}"
echo

# Prüfe ob psql verfügbar ist
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ psql nicht gefunden!${NC}"
    echo "Installiere PostgreSQL Client:"
    echo "  Ubuntu/Debian: sudo apt install postgresql-client"
    echo "  macOS: brew install postgresql"
    echo "  Windows: Installiere PostgreSQL"
    exit 1
fi

# Prüfe Datenbankverbindung
echo -e "${BLUE}🔍 Prüfe Datenbankverbindung...${NC}"
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\q" 2>/dev/null

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Datenbankverbindung fehlgeschlagen!${NC}"
    echo "Prüfe deine Umgebungsvariablen:"
    echo "  DB_HOST=${DB_HOST}"
    echo "  DB_PORT=${DB_PORT}"
    echo "  DB_NAME=${DB_NAME}"
    echo "  DB_USER=${DB_USER}"
    echo "  DB_PASSWORD=***"
    exit 1
fi

echo -e "${GREEN}✅ Datenbankverbindung erfolgreich${NC}"

# Zähle Zeilen in games Tabelle
echo -e "${BLUE}📊 Ermittle Anzahl Spiele...${NC}"
GAME_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM games;")
GAME_COUNT=$(echo $GAME_COUNT | tr -d ' ')

if [ -z "$GAME_COUNT" ] || [ "$GAME_COUNT" = "0" ]; then
    echo -e "${YELLOW}⚠️  Keine Spiele in der Datenbank gefunden${NC}"
    exit 1
fi

echo -e "${GREEN}📊 ${GAME_COUNT} Spiele gefunden${NC}"

# CSV Export
echo -e "${BLUE}🚀 Starte CSV Export...${NC}"

PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
COPY (
    SELECT 
        gameid,
        team1,
        team2,
        roundname,
        roundid,
        tournamentid,
        tournamentname,
        season,
        cuptype,
        gender,
        fieldtype,
        gamedate,
        gametime,
        venue,
        status,
        result,
        source,
        apiendpoint,
        link,
        hometeamscore,
        awayteamscore,
        gamelocation,
        referees,
        spectators,
        notes,
        numericgameid,
        bracketsortorder,
        crawledat,
        updatedat
    FROM games 
    ORDER BY crawledat DESC
) TO STDOUT WITH (FORMAT CSV, HEADER, DELIMITER ',', QUOTE '\"', ESCAPE '\"')
" > "$OUTPUT_FILE"

# Prüfe Export-Erfolg
if [ $? -eq 0 ] && [ -f "$OUTPUT_FILE" ]; then
    FILE_SIZE=$(ls -lh "$OUTPUT_FILE" | awk '{print $5}')
    LINE_COUNT=$(wc -l < "$OUTPUT_FILE")
    ACTUAL_GAMES=$((LINE_COUNT - 1)) # Header abziehen
    
    echo -e "${GREEN}✅ CSV Export erfolgreich!${NC}"
    echo -e "${GREEN}📁 Datei:${NC} ${OUTPUT_FILE}"
    echo -e "${GREEN}📊 Größe:${NC} ${FILE_SIZE}"
    echo -e "${GREEN}📈 Zeilen:${NC} ${ACTUAL_GAMES} Spiele + 1 Header = ${LINE_COUNT} total"
    
    # Zeige erste paar Zeilen als Preview
    echo
    echo -e "${BLUE}👀 Preview (erste 3 Zeilen):${NC}"
    echo "----------------------------------------"
    head -n 3 "$OUTPUT_FILE"
    echo "..."
    
else
    echo -e "${RED}❌ CSV Export fehlgeschlagen!${NC}"
    if [ -f "$OUTPUT_FILE" ]; then
        echo "Datei wurde erstellt, aber möglicherweise unvollständig."
        rm "$OUTPUT_FILE"
    fi
    exit 1
fi

echo
echo -e "${GREEN}🎉 Export abgeschlossen!${NC}"
echo -e "💡 Tipp: Öffne ${OUTPUT_FILE} in Excel, Google Sheets oder einem Text-Editor"