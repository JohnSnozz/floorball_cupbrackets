// Smart Bracket - EXAKT wie brackets.js Struktur
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
    
    sortedRounds.forEach(([roundName, roundGames], roundIndex) => {
        const sortedGames = roundGames.sort((a, b) => 
            parseInt(a.bracketSortOrder) - parseInt(b.bracketSortOrder)
        );
        const visibleGames = sortedGames.filter(g => !isDoubleFreilosGame(g));
        
        if (visibleGames.length === 0) return;
        
        processedRounds.push([roundName, visibleGames]);
    });
    
    return processedRounds;
}

function processSmartPositioning(rounds) {
    let maxGameCount = 0;
    let maxGameRoundIndex = -1;
    
    // Finde die Runde mit den meisten Spielen
    rounds.forEach(([roundName, roundGames], index) => {
        if (roundGames.length > maxGameCount) {
            maxGameCount = roundGames.length;
            maxGameRoundIndex = index;
        }
    });
    
    const maxBracketHeight = maxGameCount * MATCH_HEIGHT + (maxGameCount - 1) * 4;
    const smartRounds = [];
    
    for (let i = 0; i < rounds.length; i++) {
        const [roundName, roundGames] = rounds[i];
        const roundX = i * TOTAL_ROUND_SPACING;
        let gamePositions;
        
        if (i === maxGameRoundIndex) {
            // Max Game Round - gleichmäßig verteilt
            gamePositions = roundGames.map((game, idx) => ({
                game, 
                x: roundX, 
                y: idx * (MATCH_HEIGHT + 4), 
                width: ROUND_WIDTH, 
                height: MATCH_HEIGHT
            }));
            smartRounds.push({
                name: roundName, 
                games: roundGames, 
                gamePositions, 
                isMaxGameRound: true, 
                roundX
            });
        } else if (i < maxGameRoundIndex) {
            // Vor Max Game Round - verteilt über gesamte Höhe
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
                name: roundName, 
                games: roundGames, 
                gamePositions, 
                isMaxGameRound: false, 
                roundX
            });
        } else {
            // Nach Max Game Round - basierend auf Vorgängern
            const previousRound = smartRounds[i - 1];
            gamePositions = calculatePostMaxRound(roundGames, previousRound, roundX);
            smartRounds.push({
                name: roundName, 
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
        const currentSortOrder = parseInt(game.bracketSortOrder);
        
        // Finde Vorgänger basierend auf bracketSortOrder
        const pred1SortOrder = (currentSortOrder * 2) - 1;
        const pred2SortOrder = currentSortOrder * 2;
        
        const pred1 = previousRound.gamePositions.find(pos => 
            parseInt(pos.game.bracketSortOrder) === pred1SortOrder
        );
        const pred2 = previousRound.gamePositions.find(pos => 
            parseInt(pos.game.bracketSortOrder) === pred2SortOrder
        );
        
        let y;
        if (pred1 && pred2) {
            // Mittelwert der beiden Vorgänger
            y = (pred1.y + pred2.y) / 2;
        } else if (pred1) {
            y = pred1.y;
        } else if (pred2) {
            y = pred2.y;
        } else {
            // Fallback
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

function renderSmartBracket() {
    const bracketContent = document.getElementById('bracketContent');
    if (currentRounds.length === 0) {
        bracketContent.innerHTML = '<div class="error">Keine Runden gefunden</div>';
        return;
    }
    
    // Berechne die Smart-Positionierung
    const smartRounds = processSmartPositioning(currentRounds);
    const totalWidth = smartRounds.length * TOTAL_ROUND_SPACING;
    const totalHeight = debugData.maxBracketHeight || 400;
    
    // Nur Smart Bracket ohne Headers
    let html = `<div class="smart-bracket" style="position: relative; width: ${totalWidth}px; height: ${totalHeight}px; margin: 0 auto;">`;
    
    smartRounds.forEach(round => {
        round.gamePositions.forEach(position => {
            html += renderAbsoluteMatch(position);
        });
    });
    
    html += '</div>';
    
    bracketContent.innerHTML = html;
    
    setTimeout(() => {
        adjustLongTeamNames();
        if (typeof initializeTeamHighlighting === 'function') initializeTeamHighlighting();
        if (typeof initializeSmartMatchLinks === 'function') initializeSmartMatchLinks();
    }, 100);
}

function renderMatch(game, gameIndex, roundIndex) {
    const team1Winner = isWinner(game, game.team1);
    const team2Winner = isWinner(game, game.team2);
    const hasResult = game.result && game.result.trim() && game.result !== 'TBD';
    const isFreilos = game.team1 === 'Freilos' || game.team2 === 'Freilos';
    
    let matchClasses = 'smart-match';
    if (isFreilos) matchClasses += ' freilos';
    
    const bracketInfo = `data-bracket-sort="${game.bracketSortOrder}"`;
    const sortOrderInfo = `data-sort-order="${gameIndex + 1}"`;
    const gameIdInfo = `data-game-id="${game.numericGameId || ''}"`;
    
    let html = `<div class="${matchClasses}" ${bracketInfo} ${sortOrderInfo} ${gameIdInfo}>`;
    
    if (!hasResult && !isFreilos) {
        html += renderTBDMatch(game);
    } else if (isFreilos) {
        html += renderFreilosMatch(game);
    } else {
        html += renderFinishedMatch(game, team1Winner, team2Winner);
    }
    
    html += '</div>';
    return html;
}

function renderTBDMatch(game) {
    return `
        <div class="team tbd">
            <span class="team-name">${game.team1 || 'TBD'}</span>
        </div>
        <div class="team tbd">
            <span class="team-name">${game.team2 || 'TBD'}</span>
        </div>
    `;
}

function renderFreilosMatch(game) {
    const team1IsFreilos = game.team1 === 'Freilos';
    const team2IsFreilos = game.team2 === 'Freilos';
    
    if (team1IsFreilos && team2IsFreilos) {
        return `
            <div class="team freilos-team">
                <span class="team-name">Freilos</span>
            </div>
            <div class="team freilos-team">
                <span class="team-name">Freilos</span>
            </div>
        `;
    }
    
    let html = '';
    
    if (team1IsFreilos) {
        html += `<div class="team freilos-team"><span class="team-name">Freilos</span></div>`;
    } else {
        html += `<div class="team winner"><span class="team-name">${game.team1}</span></div>`;
    }
    
    if (team2IsFreilos) {
        html += `<div class="team freilos-team"><span class="team-name">Freilos</span></div>`;
    } else {
        html += `<div class="team winner"><span class="team-name">${game.team2}</span></div>`;
    }
    
    return html;
}

function renderFinishedMatch(game, team1Winner, team2Winner) {
    const scores = parseScore(game.result);
    
    return `
        <div class="team ${team1Winner ? 'winner' : ''}">
            <span class="team-name">${game.team1}</span>
            <span class="team-score">${scores.team1}</span>
        </div>
        <div class="team ${team2Winner ? 'winner' : ''}">
            <span class="team-name">${game.team2}</span>
            <span class="team-score">${scores.team2}</span>
        </div>
    `;
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
    debugDiv.textContent = `Smart Bracket Debug:\nRunden: ${debugData.smartRounds}\nMax Games: ${debugData.maxGameCount}`;
    
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