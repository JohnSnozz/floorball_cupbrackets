// Smart Bracket - Kompakt
let currentGames = [];
let currentRounds = [];
let debugData = {};

const MATCH_HEIGHT = 62;
const ROUND_WIDTH = 180;
const ROUND_GAP = 40;
const TOTAL_ROUND_SPACING = ROUND_WIDTH + ROUND_GAP;

function getUnifiedRoundPriority(roundName) {
    const match = roundName.toLowerCase().match(/^1\/(\d+)$/);
    if (!match) throw new Error(`Ungültiges Format: "${roundName}". Erwarte 1/X`);
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

async function loadSmartBracket() {
    const cupType = document.getElementById('cupSelect').value;
    const season = document.getElementById('seasonSelect').value;
    const bracketContent = document.getElementById('bracketContent');
    const infoBox = document.getElementById('infoBox');
    
    bracketContent.innerHTML = '<div class="loading">⏳ Lade Smart Bracket...</div>';
    infoBox.style.display = 'none';
    
    try {
        const response = await fetch(`/games?cup=${cupType}&season=${season}&limit=1000`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const games = await response.json();
        if (games.length === 0) {
            bracketContent.innerHTML = '<div class="error">Keine Spiele gefunden</div>';
            return;
        }
        
        currentGames = games;
        
        const gamesWithSort = games.filter(g => g.bracketSortOrder);
        if (gamesWithSort.length < games.length) {
            bracketContent.innerHTML = '<div class="error">bracketSortOrder fehlt</div>';
            return;
        }
        
        const smartRounds = processSmartBracket(games);
        currentRounds = smartRounds;
        
        const nonFreilos = games.filter(g => !isFreilosGame(g)).length;
        infoBox.innerHTML = `📊 ${games.length} total • ${nonFreilos} real • ${smartRounds.length} rounds`;
        infoBox.style.display = 'flex';
        
        renderSmartBracket();
        
    } catch (error) {
        bracketContent.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    }
}

function processSmartBracket(games) {
    const roundsMap = new Map();
    games.forEach(game => {
        const roundName = game.roundName || 'Unknown';
        if (!roundsMap.has(roundName)) roundsMap.set(roundName, []);
        roundsMap.get(roundName).push(game);
    });
    
    const sortedRounds = Array.from(roundsMap.entries()).sort((a, b) => 
        getUnifiedRoundPriority(a[0]) - getUnifiedRoundPriority(b[0])
    );
    
    const processedRounds = [];
    let maxGameCount = 0;
    let maxGameRoundIndex = -1;
    
    sortedRounds.forEach(([roundName, roundGames], roundIndex) => {
        const sortedGames = roundGames.sort((a, b) => 
            parseInt(a.bracketSortOrder) - parseInt(b.bracketSortOrder)
        );
        const visibleGames = sortedGames.filter(g => !isDoubleFreilosGame(g));
        
        if (visibleGames.length === 0) return;
        
        if (visibleGames.length > maxGameCount) {
            maxGameCount = visibleGames.length;
            maxGameRoundIndex = processedRounds.length;
        }
        
        processedRounds.push({
            name: roundName,
            games: visibleGames,
            allGames: sortedGames,
            originalGameCount: sortedGames.length,
            index: roundIndex
        });
    });
    
    if (processedRounds.length === 0) return [];
    
    const maxBracketHeight = maxGameCount * MATCH_HEIGHT + (maxGameCount - 1) * 4;
    const smartRounds = [];
    
    for (let i = 0; i < processedRounds.length; i++) {
        const round = processedRounds[i];
        const roundX = i * TOTAL_ROUND_SPACING;
        let gamePositions;
        
        if (i === maxGameRoundIndex) {
            gamePositions = round.games.map((game, idx) => ({
                game, x: roundX, y: idx * (MATCH_HEIGHT + 4), 
                width: ROUND_WIDTH, height: MATCH_HEIGHT
            }));
            const allGamePositions = createAllGamePositions(round.allGames, round.games, gamePositions);
            smartRounds.push({...round, gamePositions, allGamePositions, isMaxGameRound: true, roundX});
        } else if (i < maxGameRoundIndex) {
            if (round.games.length === 1) {
                const y = (maxBracketHeight - MATCH_HEIGHT) / 2;
                gamePositions = [{game: round.games[0], x: roundX, y, width: ROUND_WIDTH, height: MATCH_HEIGHT}];
            } else {
                const spacing = (maxBracketHeight - MATCH_HEIGHT) / (round.games.length - 1);
                gamePositions = round.games.map((game, idx) => ({
                    game, x: roundX, y: idx * spacing, width: ROUND_WIDTH, height: MATCH_HEIGHT
                }));
            }
            const allGamePositions = createAllGamePositions(round.allGames, round.games, gamePositions);
            smartRounds.push({...round, gamePositions, allGamePositions, isMaxGameRound: false, roundX});
        } else {
            const previousRound = smartRounds[i - 1];
            gamePositions = calculatePostMaxRound(round, previousRound, roundX);
            smartRounds.push({...round, gamePositions, isMaxGameRound: false, roundX});
        }
    }
    
    debugData = {
        totalRounds: sortedRounds.length,
        smartRounds: smartRounds.length,
        maxGameCount,
        maxGameRoundIndex,
        maxBracketHeight
    };
    
    return smartRounds;
}

function createAllGamePositions(allGames, visibleGames, visibleGamePositions) {
    return allGames.map((game, index) => {
        const isVisible = !isDoubleFreilosGame(game);
        if (isVisible) {
            const visibleIndex = visibleGames.findIndex(vGame => 
                vGame.bracketSortOrder === game.bracketSortOrder
            );
            if (visibleIndex >= 0 && visibleIndex < visibleGamePositions.length) {
                return {...visibleGamePositions[visibleIndex], isVisible: true, originalIndex: index};
            }
        }
        return {game, x: 0, y: 0, width: 0, height: 0, isVisible: false, originalIndex: index};
    });
}

function calculatePostMaxRound(currentRound, previousRound, roundX) {
    return currentRound.games.map((game, index) => {
        const currentSortOrder = parseInt(game.bracketSortOrder);
        
        // Korrekte Formel: Für Spiel mit sortOrder X sind die Vorgänger (X*2-1) und (X*2)
        const pred1SortOrder = (currentSortOrder * 2) - 1;
        const pred2SortOrder = currentSortOrder * 2;
        
        const gamePositions = previousRound.allGamePositions || previousRound.gamePositions;
        
        // Finde Vorgänger basierend auf bracketSortOrder
        const pred1 = gamePositions.find(pos => 
            parseInt(pos.game.bracketSortOrder) === pred1SortOrder
        );
        const pred2 = gamePositions.find(pos => 
            parseInt(pos.game.bracketSortOrder) === pred2SortOrder
        );
        
        let pred1Y = null, pred2Y = null, hasDoubleFreilos = false;
        
        if (pred1) {
            if (previousRound.allGamePositions && !pred1.isVisible) {
                hasDoubleFreilos = true;
            } else {
                pred1Y = pred1.y;
            }
        }
        
        if (pred2) {
            if (previousRound.allGamePositions && !pred2.isVisible) {
                hasDoubleFreilos = true;
            } else {
                pred2Y = pred2.y;
            }
        }
        
        let y;
        if (hasDoubleFreilos) {
            // Bei Freilos: nimm die Position des sichtbaren Spiels
            y = pred1Y !== null ? pred1Y : pred2Y;
        } else if (pred1Y !== null && pred2Y !== null) {
            // Normal: Mittelwert der beiden Vorgänger
            y = (pred1Y + pred2Y) / 2;
        } else {
            // Fallback: einzelner Vorgänger oder Index-basiert
            y = pred1Y || pred2Y || (index * (MATCH_HEIGHT + 20));
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

function renderSmartBracket() {
    const bracketContent = document.getElementById('bracketContent');
    if (currentRounds.length === 0) {
        bracketContent.innerHTML = '<div class="error">Keine Runden gefunden</div>';
        return;
    }
    
    const totalWidth = currentRounds.length * TOTAL_ROUND_SPACING;
    const totalHeight = debugData.maxBracketHeight || 400;
    
    // Neuer Container für Header und Bracket zusammen
    let html = '<div class="bracket-with-headers">';
    
    // Header Container
    html += '<div class="bracket-headers">';
    currentRounds.forEach(round => {
        html += `<div class="round-header">${round.name}<span class="round-count">(${round.games.length})</span></div>`;
    });
    html += '</div>';
    
    // Bracket Container
    html += `<div class="smart-bracket-absolute" style="position: relative; width: ${totalWidth}px; height: ${totalHeight}px; margin: 0 auto;">`;
    
    currentRounds.forEach(round => {
        round.gamePositions.forEach(position => {
            html += renderMatch(position);
        });
    });
    
    html += '</div></div>'; // Schließe smart-bracket-absolute und bracket-with-headers
    
    bracketContent.innerHTML = html;
    
    setTimeout(() => {
        adjustLongTeamNames();
        if (typeof initializeTeamHighlighting === 'function') initializeTeamHighlighting();
        if (typeof initializeSmartMatchLinks === 'function') initializeSmartMatchLinks();
    }, 100);
}

function renderMatch(position) {
    const {game, x, y, width, height} = position;
    const hasResult = game.result && game.result.trim() && game.result !== 'TBD';
    const style = `position: absolute; top: ${y}px; left: ${x}px; width: ${width}px; height: ${height}px;`;
    
    let html = `<div class="smart-match-absolute" style="${style}" data-game-id="${game.numericGameId || ''}" data-bracket-sort="${game.bracketSortOrder}">`;
    
    if (!hasResult) {
        html += `<div class="team tbd"><span class="team-name">${game.team1 || 'TBD'}</span></div>`;
        html += `<div class="team tbd"><span class="team-name">${game.team2 || 'TBD'}</span></div>`;
    } else {
        const scores = parseScore(game.result);
        const team1Winner = isWinner(game, game.team1);
        const team2Winner = isWinner(game, game.team2);
        
        html += `<div class="team ${team1Winner ? 'winner' : ''}"><span class="team-name">${game.team1}</span><span class="team-score">${scores.team1}</span></div>`;
        html += `<div class="team ${team2Winner ? 'winner' : ''}"><span class="team-name">${game.team2}</span><span class="team-score">${scores.team2}</span></div>`;
    }
    
    html += '</div>';
    return html;
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

function showDebugInfo() {
    if (!debugData) {
        alert('Keine Debug-Daten verfügbar');
        return;
    }
    
    const existing = document.querySelector('.debug-info');
    if (existing) existing.remove();
    
    const debugDiv = document.createElement('div');
    debugDiv.className = 'debug-info';
    debugDiv.textContent = `Smart Bracket Debug:\nRunden: ${debugData.smartRounds}\nMax Games: ${debugData.maxGameCount}\nHöhe: ${debugData.maxBracketHeight}px`;
    
    const infoBox = document.getElementById('infoBox');
    infoBox.parentNode.insertBefore(debugDiv, infoBox.nextSibling);
}

function debugSmartBracket() {
    console.log('Smart Bracket Debug:', currentRounds);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Auto-load disabled
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        loadSmartBracket();
    }
    if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        showDebugInfo();
    }
});

// Global functions
window.loadSmartBracket = loadSmartBracket;
window.showDebugInfo = showDebugInfo;
window.debugSmartBracket = debugSmartBracket;