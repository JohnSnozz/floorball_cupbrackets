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

function renderAbsoluteMatch(position) {
    const {game, x, y, width, height} = position;
    const hasResult = game.result && game.result.trim() && game.result !== 'TBD';
    const style = `position: absolute; top: ${y}px; left: ${x}px; width: ${width}px; height: ${height}px;`;
    
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
        
        html += `<div class="team ${team1Classes}"><span class="team-name">${game.team1}</span><span class="team-score">${scores.team1}</span></div>`;
        html += `<div class="team ${team2Classes}"><span class="team-name">${game.team2}</span><span class="team-score">${scores.team2}</span></div>`;
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
    const totalHeight = debugData.maxBracketHeight || 400;
    
    // KRITISCHER FIX 1: Explizite Größenangabe für das Smart Bracket
    let html = `<div class="smart-bracket" style="position: relative; width: ${totalWidth}px; height: ${totalHeight}px;">`;
    
    smartRounds.forEach(round => {
        round.gamePositions.forEach(position => {
            html += renderAbsoluteMatch(position);
        });
    });
    
    html += '</div>';
    
    bracketcontent.innerHTML = html;
    
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
        
        if (!document.getElementById('fullscreenContainer')) {
            adjustContainerWidth();
        }
        
        // Auto-fit das Bracket nach dem Laden
        if (window.fullscreenInteraction && typeof window.fullscreenInteraction.autoFitBracket === 'function') {
            setTimeout(() => {
                window.fullscreenInteraction.autoFitBracket();
                console.log('✅ Auto-fit bracket triggered');
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

function parseScore(resultString) {
    if (!resultString || resultString === 'TBD') return {team1: 'TBD', team2: 'TBD'};
    const match = resultString.match(/(\d+)[\s\-:]+(\d+)/);
    return match ? {team1: match[1], team2: match[2]} : {team1: resultString, team2: ''};
}

function adjustLongTeamNames() {
    document.querySelectorAll('.team-name').forEach(el => {
        if (el.textContent.length > 15) el.classList.add('long-name');
    });
}

// Verbesserte dynamische Schriftgrößenanpassung für Team-Namen
function adjustTeamNameSizes() {
    console.log('🔧 Adjusting team name sizes...');
    
    const teamNames = document.querySelectorAll('.team-name');
    
    teamNames.forEach((teamNameElement, index) => {
        // Reset alle Klassen und Attribute
        teamNameElement.classList.remove('long-name', 'very-long-name', 'extra-long-name');
        teamNameElement.removeAttribute('data-length');
        
        const text = teamNameElement.textContent.trim();
        const textLength = text.length;
        
        // Bestimme Schriftgröße basierend auf Textlänge
        let lengthCategory = 'short';
        
        if (textLength >= 30) {
            lengthCategory = 'extra-long';
            teamNameElement.classList.add('extra-long-name');
        } else if (textLength >= 25) {
            lengthCategory = 'very-long';
            teamNameElement.classList.add('very-long-name');
        } else if (textLength >= 20) {
            lengthCategory = 'long';
            teamNameElement.classList.add('long-name');
        } else if (textLength >= 15) {
            lengthCategory = 'medium';
        }
        
        // Setze data-attribute für CSS-Selektor
        teamNameElement.setAttribute('data-length', lengthCategory);
        
        // Zusätzliche Prüfung auf tatsächliche Container-Breite
        setTimeout(() => {
            const team = teamNameElement.closest('.team');
            if (team) {
                const teamRect = team.getBoundingClientRect();
                const scoreElement = team.querySelector('.team-score');
                const scoreWidth = scoreElement ? scoreElement.getBoundingClientRect().width : 22;
                
                // Verfügbare Breite berechnen (Container - Score - Info-Button - Padding)
                const availableWidth = teamRect.width - scoreWidth - 30 - 20; // 30px für Info-Button, 20px Padding
                
                // Setze maximale Breite
                teamNameElement.style.maxWidth = `${Math.max(availableWidth, 80)}px`;
                
                // Prüfe Overflow und reduziere Schriftgröße weiter falls nötig
                const nameRect = teamNameElement.getBoundingClientRect();
                if (nameRect.width >= availableWidth - 5) { // 5px Buffer
                    if (lengthCategory === 'short') {
                        teamNameElement.setAttribute('data-length', 'medium');
                    } else if (lengthCategory === 'medium') {
                        teamNameElement.setAttribute('data-length', 'long');
                        teamNameElement.classList.add('long-name');
                    } else if (lengthCategory === 'long') {
                        teamNameElement.setAttribute('data-length', 'very-long');
                        teamNameElement.classList.remove('long-name');
                        teamNameElement.classList.add('very-long-name');
                    } else if (lengthCategory === 'very-long') {
                        teamNameElement.setAttribute('data-length', 'extra-long');
                        teamNameElement.classList.remove('very-long-name');
                        teamNameElement.classList.add('extra-long-name');
                    }
                }
            }
        }, 50);
        
        console.log(`Team ${index + 1}: "${text}" (${textLength} chars) -> ${lengthCategory}`);
    });
    
    console.log(`✅ Adjusted ${teamNames.length} team names`);
}

// Beobachter für DOM-Änderungen um dynamisch zu reagieren
function initializeFontSizeObserver() {
    const bracketContainer = document.querySelector('.bracket-container');
    if (!bracketContainer) return;
    
    const observer = new MutationObserver((mutations) => {
        let shouldAdjust = false;
        
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                // Prüfe ob neue Smart Matches hinzugefügt wurden
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE && 
                        (node.classList.contains('smart-match-absolute') || 
                         node.querySelector('.smart-match-absolute'))) {
                        shouldAdjust = true;
                    }
                });
            }
        });
        
        if (shouldAdjust) {
            setTimeout(adjustTeamNameSizes, 100);
        }
    });
    
    observer.observe(bracketContainer, {
        childList: true,
        subtree: true
    });
    
    console.log('👁️ Font size observer initialized');
}

// Integration in bestehende Funktionen
// Diese Funktion sollte in der renderSmartBracket() Funktion aufgerufen werden
function enhancedBracketSetup() {
    // Nach dem Bracket-Rendering:
    setTimeout(() => {
        adjustTeamNameSizes();
        initializeFontSizeObserver();
        
        // Bestehende Funktionen
        if (typeof initializeTeamHighlighting === 'function') {
            initializeTeamHighlighting();
        }
        if (typeof initializeSmartMatchLinks === 'function') {
            initializeSmartMatchLinks();
        }
        if (typeof initializeSmartConnectors === 'function') {
            console.log('🔗 Initializing Smart Connectors...');
            initializeSmartConnectors(smartRounds);
        }
        
        console.log('🎯 Enhanced bracket setup complete with improved font sizing');
    }, 200);
}

// Resize-Handler für responsive Anpassungen
window.addEventListener('resize', () => {
    clearTimeout(window.resizeTimeout);
    window.resizeTimeout = setTimeout(() => {
        adjustTeamNameSizes();
    }, 250);
});

// Export für globale Verwendung
window.adjustTeamNameSizes = adjustTeamNameSizes;
window.enhancedBracketSetup = enhancedBracketSetup;

// Fügen Sie diese Zeile zur bestehenden renderSmartBracket() Funktion hinzu:
// Rufen Sie adjustTeamNameSizes() nach dem Rendering auf
function enhancedRenderSmartBracket() {
    // Ihr bestehender renderSmartBracket Code hier...
    
    // Nach dem Rendering:
    setTimeout(() => {
        adjustLongTeamNames(); // Bestehende Funktion
        adjustTeamNameSizes(); // Neue Funktion
        
        if (typeof initializeTeamHighlighting === 'function') {
            initializeTeamHighlighting();
        }
        if (typeof initializeSmartMatchLinks === 'function') {
            initializeSmartMatchLinks();
        }
        if (typeof initializeSmartConnectors === 'function') {
            initializeSmartConnectors(smartRounds);
        }
        
        console.log('🎯 Enhanced bracket setup complete with dynamic font sizing');
    }, 150);
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

window.loadSmartBracket = loadSmartBracket;
window.loadAvailableOptions = loadAvailableOptions;