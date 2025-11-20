// Smart Bracket - Fixed version with proper sizing and connector integration
let currentGames = [];
let currentRounds = [];
let debugData = {};

const MATCH_HEIGHT = 62;
const ROUND_WIDTH = 240;
const ROUND_GAP = 60;
const TOTAL_ROUND_SPACING = ROUND_WIDTH + ROUND_GAP;

function getUnifiedRoundPriority(roundname) {
    const match = roundname.toLowerCase().match(/^1\/(\d+)$/);
    if (!match) throw new Error(`Ungültiges Format: "${roundname}". Erwarte 1/X`);
    return Math.log2(128) - Math.log2(parseInt(match[1])) + 1;
}

function isFreilos(team) {
    return (team || '').toLowerCase().trim() === 'freilos';
}

function isDoubleFreilosGame(game) {
    return isFreilos(game.team1) && isFreilos(game.team2);
}

function isFreilosGame(game) {
    return isFreilos(game.team1) || isFreilos(game.team2);
}

function getCurrentSeason() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    
    // Saison wechselt im Mai (Monat 5) - KORREKT
    if (month >= 5) {
        return `${year}/${String(year + 1).slice(-2)}`;
    } else {
        return `${year - 1}/${String(year).slice(-2)}`;
    }
}

async function loadAvailableOptions() {
    try {
        const seasonsResponse = await fetch('/api/seasons');
        if (seasonsResponse.ok) {
            const seasons = await seasonsResponse.json();
            const seasonselect = document.getElementById('seasonselect');
            if (seasonselect) {
                seasonselect.innerHTML = '';
                const currentSeason = getCurrentSeason();
                
                // WICHTIG: Erstelle eine vollständige Saisons-Liste die immer 2025/26 enthält
                const allSeasons = ['2025/26', '2024/25', '2023/24', '2022/23', '2021/22'];
                
                // Füge alle API-Seasons hinzu die noch nicht in der Liste sind
                seasons.forEach(season => {
                    if (!allSeasons.includes(season)) {
                        allSeasons.push(season);
                    }
                });
                
                // Sortiere die Seasons absteigend (neueste zuerst)
                allSeasons.sort((a, b) => {
                    const yearA = parseInt(a.split('/')[0]);
                    const yearB = parseInt(b.split('/')[0]);
                    return yearB - yearA;
                });
                
                allSeasons.forEach(season => {
                    const option = document.createElement('option');
                    option.value = season;
                    option.textContent = season;
                    if (season === currentSeason) option.selected = true;
                    seasonselect.appendChild(option);
                });
                
                console.log(`✅ Loaded seasons, current: ${currentSeason}, total: ${allSeasons.length}`);
                console.log('Available seasons:', allSeasons);
            }
        } else {
            throw new Error('Seasons API not available');
        }

        const cupsResponse = await fetch('/api/cups');
        if (cupsResponse.ok) {
            const cups = await cupsResponse.json();
            const cupselect = document.getElementById('cupselect');
            if (cupselect) {
                cupselect.innerHTML = '';
                
                const cupOrder = [
                    'herren_grossfeld',
                    'damen_grossfeld', 
                    'herren_kleinfeld',
                    'damen_kleinfeld'
                ];
                
                const sortedCups = cups.sort((a, b) => {
                    const indexA = cupOrder.indexOf(a.id);
                    const indexB = cupOrder.indexOf(b.id);
                    if (indexA === -1) return 1;
                    if (indexB === -1) return -1;
                    return indexA - indexB;
                });
                
                sortedCups.forEach((cup, index) => {
                    const option = document.createElement('option');
                    option.value = cup.id;
                    option.textContent = cup.name;
                    if (index === 0) option.selected = true;
                    cupselect.appendChild(option);
                });
                
                console.log(`✅ Loaded ${cups.length} cups from API`);
            }
        } else {
            throw new Error('Cups API not available');
        }
    } catch (error) {
        console.error('Fehler beim Laden der Optionen:', error);
        loadFallbackOptions();
    }
}

function loadFallbackOptions() {
    const cupselect = document.getElementById('cupselect');
    const seasonselect = document.getElementById('seasonselect');
    const currentSeason = getCurrentSeason();
    
    if (cupselect) {
        cupselect.innerHTML = `
            <option value="herren_grossfeld" selected>Mobiliar Cup Herren Grossfeld</option>
            <option value="damen_grossfeld">Mobiliar Cup Damen Grossfeld</option>
            <option value="herren_kleinfeld">Liga Cup Herren Kleinfeld</option>
            <option value="damen_kleinfeld">Liga Cup Damen Kleinfeld</option>
        `;
    }
    
    if (seasonselect) {
        seasonselect.innerHTML = `
            <option value="${currentSeason}" selected>${currentSeason}</option>
            <option value="2025/26">2025/26</option>
            <option value="2024/25">2024/25</option>
            <option value="2023/24">2023/24</option>
            <option value="2022/23">2022/23</option>
        `;
    }
}

async function loadSmartBracket() {
    const cuptype = document.getElementById('cupselect')?.value || 'herren_grossfeld';
    const season = document.getElementById('seasonselect')?.value || getCurrentSeason();
    
    const bracketcontent = document.getElementById('bracketcontent') || 
                          document.querySelector('.bracket-container') ||
                          document.querySelector('#bracketContent .bracket-container');
    
    if (!bracketcontent) {
        console.error('❌ Bracket container not found');
        return;
    }
    
    console.log(`🏒 Loading Smart Bracket: ${cuptype} - ${season}`);
    bracketcontent.innerHTML = '<div class="loading">⏳ Lade Smart Bracket...</div>';
    
    try {
        const response = await fetch(`/games?cup=${cuptype}&season=${season}&limit=1000`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const games = await response.json();
        if (games.length === 0) {
            bracketcontent.innerHTML = '<div class="error">Keine Spiele gefunden</div>';
            return;
        }
        
        currentGames = games;
        
        const gamesWithSort = games.filter(g => g.bracketsortorder);
        if (gamesWithSort.length < games.length) {
            bracketcontent.innerHTML = '<div class="error">bracketsortorder fehlt</div>';
            return;
        }
        
        const smartRounds = processSmartBracket(games);
        currentRounds = smartRounds;
        
        if (typeof resetSmartMatchLinks === 'function') {
            resetSmartMatchLinks();
            console.log('🔄 Smart match links reset for new bracket');
        }
        
        renderSmartBracket();
        
    } catch (error) {
        console.error('❌ Error loading bracket:', error);
        bracketcontent.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    }
}

function processSmartBracket(games) {
    const roundsMap = new Map();
    games.forEach(game => {
        const roundname = game.roundname || 'Unknown';
        if (!roundsMap.has(roundname)) roundsMap.set(roundname, []);
        roundsMap.get(roundname).push(game);
    });
    
    const sortedRounds = Array.from(roundsMap.entries()).sort((a, b) => 
        getUnifiedRoundPriority(a[0]) - getUnifiedRoundPriority(b[0])
    );
    
    const processedRounds = [];
    
    sortedRounds.forEach(([roundname, roundGames], roundIndex) => {
        const sortedGames = roundGames.sort((a, b) => 
            parseInt(a.bracketsortorder) - parseInt(b.bracketsortorder)
        );
        const visibleGames = sortedGames.filter(g => !isDoubleFreilosGame(g));
        
        if (visibleGames.length === 0) return;
        
        processedRounds.push([roundname, visibleGames]);
    });
    
    return processedRounds;
}

function processSmartPositioning(rounds) {
    let maxGameCount = 0;
    let maxGameRoundIndex = -1;
    
    rounds.forEach(([roundname, roundGames], index) => {
        if (roundGames.length > maxGameCount) {
            maxGameCount = roundGames.length;
            maxGameRoundIndex = index;
        }
    });
    
    const maxBracketHeight = maxGameCount * MATCH_HEIGHT + (maxGameCount - 1) * 4;
    const smartRounds = [];
    
    for (let i = 0; i < rounds.length; i++) {
        const [roundname, roundGames] = rounds[i];
        const roundX = i * TOTAL_ROUND_SPACING;
        let gamePositions;
        
        if (i === maxGameRoundIndex) {
            gamePositions = roundGames.map((game, idx) => ({
                game, 
                x: roundX, 
                y: idx * (MATCH_HEIGHT + 4), 
                width: ROUND_WIDTH, 
                height: MATCH_HEIGHT
            }));
            smartRounds.push({
                name: roundname, 
                games: roundGames, 
                gamePositions, 
                isMaxGameRound: true, 
                roundX
            });
        } else if (i < maxGameRoundIndex) {
            if (roundGames.length === 1) {
                const y = (maxBracketHeight - MATCH_HEIGHT) / 2;
                gamePositions = [{
                    game: roundGames[0], 
                    x: roundX, 
                    y, 
                    width: ROUND_WIDTH, 
                    height: MATCH_HEIGHT
                }];
            } else {
                const spacing = (maxBracketHeight - MATCH_HEIGHT) / (roundGames.length - 1);
                gamePositions = roundGames.map((game, idx) => ({
                    game, 
                    x: roundX, 
                    y: idx * spacing, 
                    width: ROUND_WIDTH, 
                    height: MATCH_HEIGHT
                }));
            }
            smartRounds.push({
                name: roundname, 
                games: roundGames, 
                gamePositions, 
                isMaxGameRound: false, 
                roundX
            });
        } else {
            const previousRound = smartRounds[i - 1];
            gamePositions = calculatePostMaxRound(roundGames, previousRound, roundX);
            smartRounds.push({
                name: roundname, 
                games: roundGames, 
                gamePositions, 
                isMaxGameRound: false, 
                roundX
            });
        }
    }
    
    debugData.maxBracketHeight = maxBracketHeight;
    debugData.maxGameCount = maxGameCount;
    debugData.maxGameRoundIndex = maxGameRoundIndex;
    
    return smartRounds;
}

function calculatePostMaxRound(currentGames, previousRound, roundX) {
    return currentGames.map((game, index) => {
        const currentSortOrder = parseInt(game.bracketsortorder);
        
        const pred1SortOrder = (currentSortOrder * 2) - 1;
        const pred2SortOrder = currentSortOrder * 2;
        
        const pred1 = previousRound.gamePositions.find(pos => 
            parseInt(pos.game.bracketsortorder) === pred1SortOrder
        );
        const pred2 = previousRound.gamePositions.find(pos => 
            parseInt(pos.game.bracketsortorder) === pred2SortOrder
        );
        
        let y;
        if (pred1 && pred2) {
            y = (pred1.y + pred2.y) / 2;
        } else if (pred1) {
            y = pred1.y;
        } else if (pred2) {
            y = pred2.y;
        } else {
            y = index * (MATCH_HEIGHT + 20);
        }
        
        return {
            game, 
            x: roundX, 
            y: y || 0, 
            width: ROUND_WIDTH, 
            height: MATCH_HEIGHT
        };
    });
}

// KORRIGIERTE parseScore Funktion mit Overtime/Penalty Detection
function parseScore(resultString) {
    if (!resultString || resultString === 'TBD') {
        return {team1: 'TBD', team2: 'TBD', overtime: null};
    }
    
    // Prüfe auf n.V. oder n.P. am Ende des Strings
    let overtime = null;
    if (resultString.trim().endsWith('n.V.')) {
        overtime = 'n.V.';
    } else if (resultString.trim().endsWith('n.P.')) {
        overtime = 'n.P.';
    } else if (resultString.includes('n.V.')) {
        overtime = 'n.V.';
    } else if (resultString.includes('n.P.')) {
        overtime = 'n.P.';
    }
    
    // Extrahiere die eigentlichen Scores (erstes Vorkommen von Zahl:Zahl)
    const match = resultString.match(/^(\d+):(\d+)/);
    
    if (match) {
        return {
            team1: match[1], 
            team2: match[2], 
            overtime: overtime
        };
    } else {
        return {
            team1: resultString, 
            team2: '', 
            overtime: overtime
        };
    }
}

function renderAbsoluteMatch(position) {
    const {game, x, y, width, height} = position;
    const hasResult = game.result && game.result.trim() && game.result !== 'TBD';
    // 30px padding top + 40px für Round-Headers = 70px offset
    const yWithHeaderSpace = y + 70;
    const style = `position: absolute; top: ${yWithHeaderSpace}px; left: ${x}px; width: ${width}px; height: ${height}px;`;
    
    let html = `<div class="smart-match-absolute" style="${style}" data-game-id="${game.numericgameid || ''}" data-bracket-sort="${game.bracketsortorder}">`;
    
    if (!hasResult) {
        const team1Classes = getTeamClasses(game, game.team1, hasResult);
        const team2Classes = getTeamClasses(game, game.team2, hasResult);
        
        html += `<div class="team ${team1Classes}"><span class="team-name">${game.team1 || 'TBD'}</span></div>`;
        html += `<div class="team ${team2Classes}"><span class="team-name">${game.team2 || 'TBD'}</span></div>`;
    } else {
        const scores = parseScore(game.result);
        const team1Classes = getTeamClasses(game, game.team1, hasResult);
        const team2Classes = getTeamClasses(game, game.team2, hasResult);
        
        // Team 1 - nur Score, kein Overtime
        html += `<div class="team ${team1Classes}">
                    <span class="team-name">${game.team1}</span>
                    <div class="team-score-container">
                        <span class="team-score">${scores.team1}</span>
                    </div>
                 </div>`;
        
        // Team 2 - nur Score, kein Overtime
        html += `<div class="team ${team2Classes}">
                    <span class="team-name">${game.team2}</span>
                    <div class="team-score-container">
                        <span class="team-score">${scores.team2}</span>
                    </div>
                 </div>`;
        
        // Overtime-Markierung ZWISCHEN den Teams (vertikal zentriert)
        if (scores.overtime) {
            html += `<div class="overtime-center-marker">${scores.overtime}</div>`;
        }
    }
    
    html += '</div>';
    return html;
}

function getTeamClasses(game, teamName, hasResult) {
    let classes = [];
    
    if (isFreilos(teamName)) {
        classes.push('freilos-team');
    } else {
        if (hasResult && isWinner(game, teamName)) {
            classes.push('winner');
        } else if (isFreilosGame(game) && !isFreilos(teamName)) {
            classes.push('winner');
        } else if (!hasResult && !isFreilosGame(game)) {
            classes.push('tbd');
        }
    }
    
    return classes.join(' ');
}

function renderSmartBracket() {
    const bracketcontent = document.getElementById('bracketcontent') || 
                          document.querySelector('.bracket-container') ||
                          document.querySelector('#bracketContent .bracket-container');
    
    if (!bracketcontent) {
        console.error('❌ Bracket container not found for rendering');
        return;
    }
    
    if (currentRounds.length === 0) {
        bracketcontent.innerHTML = '<div class="error">Keine Runden gefunden</div>';
        return;
    }
    
    const smartRounds = processSmartPositioning(currentRounds);
    const totalWidth = smartRounds.length * TOTAL_ROUND_SPACING;
    const totalHeight = (debugData.maxBracketHeight || 400) + 40; // +40px für Round-Headers

    // Padding oben und unten für besseres Pan-Verhalten
    const verticalPadding = 30; // 30px oben und unten
    const totalHeightWithPadding = totalHeight + (verticalPadding * 2);

    // KRITISCHER FIX 1: Explizite Größenangabe für das Smart Bracket mit Padding
    let html = `<div class="smart-bracket" style="position: relative; width: ${totalWidth}px; height: ${totalHeightWithPadding}px; padding: ${verticalPadding}px 0;">`;
    
    smartRounds.forEach(round => {
        round.gamePositions.forEach(position => {
            html += renderAbsoluteMatch(position);
        });
    });
    
    html += '</div>';

    bracketcontent.innerHTML = html;

    // KRITISCHER FIX: Entferne .loading Klasse und setze korrekte Position
    bracketcontent.classList.remove('loading', 'error');
    bracketcontent.style.position = 'static';
    bracketcontent.style.top = 'auto';
    bracketcontent.style.left = 'auto';
    bracketcontent.style.transform = 'none';

    console.log(`✅ Bracket rendered: ${totalWidth}x${totalHeight}px`);
    
    setTimeout(() => {
        adjustLongTeamNames();
        
        if (typeof initializeTeamHighlighting === 'function') {
            initializeTeamHighlighting();
        }
        if (typeof initializeSmartMatchLinks === 'function') {
            initializeSmartMatchLinks();
        }
        
        // KRITISCHER FIX 2: Smart Connectors mit korrekten Daten initialisieren
        if (typeof initializeSmartConnectors === 'function') {
            console.log('🔗 Initializing Smart Connectors with processed rounds...');
            initializeSmartConnectors(smartRounds);
        } else {
            console.log('⚠️ initializeSmartConnectors function not found');
        }
        
        // KRITISCHER FIX 3: Round Headers mit echten Rundennamen initialisieren
        if (typeof initializeRoundHeaders === 'function') {
            console.log('📋 Initializing Round Headers with real round names...');
            // Speichere smartRounds global für round-headers.js
            window.lastProcessedSmartRounds = smartRounds;
            initializeRoundHeaders(smartRounds);
        } else {
            console.log('⚠️ initializeRoundHeaders function not found');
        }
        
        if (!document.getElementById('fullscreenContainer')) {
            adjustContainerWidth();
        }
        
        // Reset zu 100% Zoom, top-center
        if (window.fullscreenInteraction && typeof window.fullscreenInteraction.resetView === 'function') {
            setTimeout(() => {
                window.fullscreenInteraction.resetView();
                console.log('✅ Bracket reset to 100% top-center');
            }, 500);
        }
        
        console.log('🎯 Bracket setup complete');
    }, 150);
}

function adjustContainerWidth() {
    setTimeout(() => {
        const container = document.querySelector('.container');
        const bracket = document.querySelector('.smart-bracket');
        
        if (bracket && container) {
            const bracketWidth = bracket.scrollWidth;
            const padding = 60;
            container.style.width = `${bracketWidth + padding}px`;
            console.log(`📏 Container-Breite angepasst: ${bracketWidth + padding}px`);
        }
    }, 200);
}

function isWinner(game, teamName) {
    if (!game.result || game.result === 'TBD') return false;
    const scores = parseScore(game.result);
    if (!scores) return false;
    
    const s1 = parseInt(scores.team1) || 0;
    const s2 = parseInt(scores.team2) || 0;
    if (s1 === s2) return false;
    
    return (teamName === game.team1 && s1 > s2) || (teamName === game.team2 && s2 > s1);
}

function adjustLongTeamNames() {
    document.querySelectorAll('.team-name').forEach(el => {
        if (el.textContent.length > 15) el.classList.add('long-name');
    });
}

// TEST-FUNKTIONEN für Debugging
// 1. FINDE DAS SPEZIFISCHE SPIEL IN DEN GELADENEN DATEN
function findOvertimeGameInCurrentGames() {
    console.log('🔍 SUCHE NACH DEM BEKANNTEN OVERTIME SPIEL IN currentGames:');
    console.log('='.repeat(60));
    
    if (!currentGames || currentGames.length === 0) {
        console.log('❌ currentGames ist leer oder nicht verfügbar');
        return null;
    }
    
    // Suche nach dem bekannten Spiel: 4:5 (1:0, 3:1, 0:3, 0:1) n.V.
    const overtimeGame = currentGames.find(game => 
        game.result && game.result.includes('4:5') && game.result.includes('n.V.')
    );
    
    if (overtimeGame) {
        console.log('✅ OVERTIME SPIEL GEFUNDEN:');
        console.log('Game ID:', overtimeGame.numericgameid);
        console.log('Teams:', overtimeGame.team1, 'vs', overtimeGame.team2);
        console.log('Result:', `"${overtimeGame.result}"`);
        console.log('Round:', overtimeGame.roundname);
        console.log('Sort Order:', overtimeGame.bracketsortorder);
        
        // Teste parseScore für dieses spezifische Spiel
        const parsed = parseScore(overtimeGame.result);
        console.log('Parsed Score:', parsed);
        
        return overtimeGame;
    } else {
        console.log('❌ Das bekannte Overtime-Spiel wurde NICHT in currentGames gefunden');
        console.log('🔍 Erste 5 Spiele zur Referenz:');
        currentGames.slice(0, 5).forEach((game, index) => {
            console.log(`Game ${index + 1}: ${game.team1} vs ${game.team2} = "${game.result}"`);
        });
        return null;
    }
}

// 2. PRÜFE OB DAS SPIEL IM DOM KORREKT GERENDERT WURDE
function checkOvertimeGameInDOM() {
    console.log('🔍 PRÜFE OVERTIME SPIEL IM DOM:');
    console.log('='.repeat(60));
    
    const smartMatches = document.querySelectorAll('.smart-match-absolute');
    console.log(`Gefundene Smart Matches im DOM: ${smartMatches.length}`);
    
    let foundOvertimeInDOM = false;
    
    smartMatches.forEach((match, index) => {
        // Suche nach dem bekannten Overtime-Spiel im DOM
        const teams = match.querySelectorAll('.team-name');
        const scores = match.querySelectorAll('.team-score');
        
        if (teams.length >= 2 && scores.length >= 2) {
            const team1 = teams[0].textContent.trim();
            const team2 = teams[1].textContent.trim();
            const score1 = scores[0].textContent.trim();
            const score2 = scores[1].textContent.trim();
            
            // Prüfe auf 4:5 Ergebnis
            if (score1 === '4' && score2 === '5') {
                console.log(`\n🎯 GEFUNDEN: Match ${index + 1} mit 4:5 Ergebnis:`);
                console.log(`Teams: ${team1} vs ${team2}`);
                console.log(`Scores: ${score1}:${score2}`);
                
                // Prüfe auf Overtime-Elemente
                const overtimeElements = match.querySelectorAll('.score-overtime, .score-overtime-inline, .overtime-indicator');
                console.log(`Overtime-Elemente gefunden: ${overtimeElements.length}`);
                
                if (overtimeElements.length > 0) {
                    overtimeElements.forEach((el, idx) => {
                        console.log(`  Overtime Element ${idx + 1}: "${el.textContent}" (class: ${el.className})`);
                    });
                    foundOvertimeInDOM = true;
                } else {
                    console.log('❌ KEINE Overtime-Elemente im DOM gefunden!');
                    
                    // Zeige die komplette HTML-Struktur dieses Matches
                    console.log('📋 Komplette Match-HTML:');
                    console.log(match.outerHTML);
                }
                
                // Prüfe game-id
                const gameId = match.getAttribute('data-game-id');
                console.log(`Game ID: ${gameId}`);
            }
        }
    });
    
    if (!foundOvertimeInDOM) {
        console.log('❌ Kein Overtime-Spiel mit 4:5 Ergebnis im DOM gefunden');
    }
    
    return foundOvertimeInDOM;
}

// 3. VOLLSTÄNDIGER OVERTIME-DEBUG
function fullOvertimeDebug() {
    console.log('🚀 VOLLSTÄNDIGER OVERTIME-DEBUG:');
    console.log('='.repeat(60));
    
    // Schritt 1: Finde Spiel in currentGames
    const gameInData = findOvertimeGameInCurrentGames();
    
    // Schritt 2: Prüfe DOM
    const gameInDOM = checkOvertimeGameInDOM();
    
    // Schritt 3: Vergleiche
    console.log('\n📊 ZUSAMMENFASSUNG:');
    console.log(`✅ Spiel in currentGames gefunden: ${gameInData ? 'JA' : 'NEIN'}`);
    console.log(`✅ Overtime im DOM angezeigt: ${gameInDOM ? 'JA' : 'NEIN'}`);
    
    if (gameInData && !gameInDOM) {
        console.log('\n🔧 PROBLEM IDENTIFIZIERT:');
        console.log('Das Spiel ist in den Daten vorhanden, aber die Overtime-Anzeige wird nicht korrekt gerendert.');
        console.log('LÖSUNG: Die renderAbsoluteMatch Funktion muss aktualisiert werden.');
        
        // Zeige die aktuelle renderAbsoluteMatch Implementierung
        console.log('\n🔍 Aktuelle renderAbsoluteMatch Funktion:');
        console.log(renderAbsoluteMatch.toString());
    }
    
    return { gameInData, gameInDOM };
}

// 4. TESTE DIE KORRIGIERTE renderAbsoluteMatch FUNKTION
function testCorrectedRenderFunction() {
    console.log('🧪 TESTE KORRIGIERTE RENDER-FUNKTION:');
    
    // Finde das Overtime-Spiel
    const overtimeGame = findOvertimeGameInCurrentGames();
    if (!overtimeGame) {
        console.log('❌ Kein Overtime-Spiel zum Testen gefunden');
        return;
    }
    
    // Simuliere Position
    const testPosition = {
        game: overtimeGame,
        x: 0,
        y: 0,
        width: 240,
        height: 62
    };
    
    // Teste parseScore
    const scores = parseScore(overtimeGame.result);
    console.log('ParseScore Ergebnis:', scores);
    
    // Erstelle Test-HTML mit der korrigierten Funktion
    console.log('\n🔧 Test-HTML würde so aussehen:');
    
    const hasResult = overtimeGame.result && overtimeGame.result.trim() && overtimeGame.result !== 'TBD';
    console.log('hasResult:', hasResult);
    
    if (hasResult && scores.overtime) {
        console.log('✅ Overtime würde korrekt erkannt und gerendert werden!');
        console.log(`Team 1: ${overtimeGame.team1} - Score: ${scores.team1}`);
        console.log(`Team 2: ${overtimeGame.team2} - Score: ${scores.team2} - Overtime: ${scores.overtime}`);
    } else {
        console.log('❌ Problem beim Erkennen von Overtime');
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Smart Bracket');
    
    loadAvailableOptions().then(() => {
        console.log('✅ Options loaded, auto-loading bracket');
        loadSmartBracket();
    }).catch(error => {
        console.error('❌ Error loading options:', error);
        loadSmartBracket();
    });
    
    let loadTimeout;
    
    const cupSelect = document.getElementById('cupselect');
    const seasonSelect = document.getElementById('seasonselect');
    
    if (cupSelect) {
        cupSelect.addEventListener('change', function() {
            clearTimeout(loadTimeout);
            console.log('🔄 Cup selection changed');
        });
    }
    
    if (seasonSelect) {
        seasonSelect.addEventListener('change', function() {
            clearTimeout(loadTimeout);
            console.log('🔄 Season selection changed');
        });
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        console.log('🔄 Keyboard shortcut: Reload bracket');
        loadSmartBracket();
    }
});

// Export functions
window.fullOvertimeDebug = fullOvertimeDebug;
window.findOvertimeGameInCurrentGames = findOvertimeGameInCurrentGames;
window.checkOvertimeGameInDOM = checkOvertimeGameInDOM;
window.testCorrectedRenderFunction = testCorrectedRenderFunction;