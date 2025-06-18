// Neues brackets.js mit bracket-basierter Sortierung

let currentGames = [];
let currentRounds = [];

async function loadBracket() {
    const cupType = document.getElementById('cupSelect').value;
    const season = document.getElementById('seasonSelect').value;
    const bracketContent = document.getElementById('bracketContent');
    const infoBox = document.getElementById('infoBox');
    
    bracketContent.innerHTML = '<div class="loading">⏳ Lade Bracket-Daten...</div>';
    infoBox.style.display = 'none';
    
    try {
        const response = await fetch(`/games?cup=${cupType}&season=${season}&limit=1000`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const games = await response.json();
        
        if (games.length === 0) {
            bracketContent.innerHTML = `
                <div class="error">
                    Keine Spiele gefunden für ${cupType} in Saison ${season}.<br>
                    Versuche zuerst die Spiele zu crawlen auf der Hauptseite.
                </div>
            `;
            return;
        }
        
        currentGames = games;
        
        // Gruppiere und sortiere Spiele nach Runden
        const processedRounds = processGamesByRounds(games);
        currentRounds = processedRounds;
        
        infoBox.innerHTML = `📊 ${games.length} Spiele in ${currentRounds.length} Runden geladen`;
        infoBox.style.display = 'flex';
        
        renderBracket();
        
    } catch (error) {
        console.error('Error loading bracket:', error);
        bracketContent.innerHTML = `
            <div class="error">
                Fehler beim Laden der Bracket-Daten: ${error.message}
            </div>
        `;
    }
}

function processGamesByRounds(games) {
    console.log('🎯 Processing games with bracket-based sorting...');
    
    // Gruppiere nach Runden
    const roundsMap = new Map();
    games.forEach(game => {
        const roundName = game.roundName || 'Unbekannte Runde';
        if (!roundsMap.has(roundName)) {
            roundsMap.set(roundName, []);
        }
        roundsMap.get(roundName).push(game);
    });
    
    // Sortiere Runden chronologisch (früh zu spät)
    const sortedRounds = Array.from(roundsMap.entries()).sort((a, b) => {
        const aValue = getRoundValue(a[0]);
        const bValue = getRoundValue(b[0]);
        console.log(`🔄 Round comparison: "${a[0]}" (${aValue}) vs "${b[0]}" (${bValue})`);
        return aValue - bValue;
    });
    
    // Sortiere Spiele innerhalb jeder Runde mit bracket-basierter Logik
    const processedRounds = sortedRounds.map(([roundName, roundGames]) => {
        console.log(`\n📊 Processing round: ${roundName} (${roundGames.length} games)`);
        
        const sortedGames = sortGamesForBracket(roundGames);
        
        console.log(`✅ Sorted ${sortedGames.length} games by bracket order`);
        sortedGames.forEach((game, index) => {
            const bracketSort = game.bracketSortOrder || 'N/A';
            const numericId = game.numericGameId || 'N/A';
            const preview = `${game.team1} vs ${game.team2}`.substring(0, 25);
            console.log(`   ${index + 1}. ${preview} (Bracket: ${bracketSort}, ID: ${numericId})`);
        });
        
        return [roundName, sortedGames];
    });
    
    console.log(`🎯 Final bracket structure: ${processedRounds.length} rounds processed`);
    return processedRounds;
}

function sortGamesForBracket(games) {
    return games.sort((a, b) => {
        // Priorität 1: bracketSortOrder (falls berechnet)
        if (a.bracketSortOrder && b.bracketSortOrder) {
            const result = a.bracketSortOrder - b.bracketSortOrder;
            if (result !== 0) return result;
        }
        
        // Priorität 2: numericGameId
        const numericIdA = a.numericGameId ? parseInt(a.numericGameId) : null;
        const numericIdB = b.numericGameId ? parseInt(b.numericGameId) : null;
        
        if (numericIdA !== null && numericIdB !== null) {
            const result = numericIdA - numericIdB;
            if (result !== 0) return result;
        }
        
        // Ein Game hat numericGameId, das andere nicht
        if (numericIdA !== null && numericIdB === null) return -1;
        if (numericIdA === null && numericIdB !== null) return 1;
        
        // Priorität 3: Extrahiere Zahlen aus gameId
        const gameIdA = a.gameId || '';
        const gameIdB = b.gameId || '';
        
        const extractedNumA = gameIdA.match(/(\d+)/);
        const extractedNumB = gameIdB.match(/(\d+)/);
        
        if (extractedNumA && extractedNumB) {
            const numA = parseInt(extractedNumA[1]);
            const numB = parseInt(extractedNumB[1]);
            const result = numA - numB;
            if (result !== 0) return result;
        }
        
        // Fallback: Alphabetische Sortierung
        return gameIdA.localeCompare(gameIdB);
    });
}

function getRoundValue(roundName) {
    const name = roundName.toLowerCase();
    
    // 1/X Format (Cup-Notation) - je größer X, desto früher
    const fractionMatch = name.match(/1\/(\d+)/);
    if (fractionMatch) {
        const denominator = parseInt(fractionMatch[1]);
        if (denominator === 128) return 1;
        if (denominator === 64) return 2;
        if (denominator === 32) return 3;
        if (denominator === 16) return 4;
        if (denominator === 8) return 5;
        if (denominator === 4) return 6;
        if (denominator === 2) return 7;
        if (denominator === 1) return 8;
        return 100 + (128 - denominator);
    }
    
    // Explizite Rundennamen
    if (name.includes('1.') || name.includes('erste')) return 1;
    if (name.includes('2.') || name.includes('zweite')) return 2;
    if (name.includes('3.') || name.includes('dritte')) return 3;
    if (name.includes('4.') || name.includes('vierte')) return 4;
    if (name.includes('5.') || name.includes('fünfte')) return 5;
    if (name.includes('6.') || name.includes('sechste')) return 6;
    if (name.includes('7.') || name.includes('siebte')) return 7;
    if (name.includes('8.') || name.includes('achte')) return 8;
    
    // Spezielle Rundennamen
    if (name.includes('achtelfinale') || name.includes('1/8')) return 5;
    if (name.includes('viertelfinale') || name.includes('1/4')) return 6;
    if (name.includes('halbfinale') || name.includes('1/2')) return 7;
    if (name.includes('finale') || name.includes('final') || name.includes('1/1')) return 8;
    
    // Fallback: Extrahiere erste Zahl
    const numberMatch = name.match(/(\d+)/);
    if (numberMatch) {
        return parseInt(numberMatch[1]);
    }
    
    // Letzter Fallback: Alphabetisch
    return 1000 + name.charCodeAt(0);
}

function renderBracket() {
    const bracketContent = document.getElementById('bracketContent');
    
    if (currentRounds.length === 0) {
        bracketContent.innerHTML = '<div class="error">Keine Runden gefunden</div>';
        return;
    }
    
    let html = '';
    
    // Headers Container
    html += '<div class="bracket-headers">';
    currentRounds.forEach(([roundName, roundGames]) => {
        html += `
            <div class="round-header">
                ${roundName}
                <span class="round-count">(${roundGames.length} Spiele)</span>
            </div>
        `;
    });
    html += '</div>';
    
    // Bracket Container
    html += '<div class="bracket">';
    
    currentRounds.forEach(([roundName, roundGames], roundIndex) => {
        html += `
            <div class="round round-${roundIndex + 1}">
                <div class="round-matches">
        `;
        
        roundGames.forEach((game, gameIndex) => {
            html += renderMatch(game, gameIndex, roundIndex);
        });
        
        html += '</div></div>';
    });
    
    html += '</div>';
    
    bracketContent.innerHTML = html;
    
    // Nach dem Rendern: Zusätzliche Features
    setTimeout(() => {
        adjustLongTeamNames();
        
        if (typeof generateConnectionLines === 'function') {
            generateConnectionLines();
        }
        
        if (typeof initializeTeamHighlighting === 'function') {
            initializeTeamHighlighting();
        }
    }, 100);
}

function renderMatch(game, gameIndex, roundIndex) {
    const team1Winner = isWinner(game, game.team1);
    const team2Winner = isWinner(game, game.team2);
    const hasResult = game.result && game.result.trim() && game.result !== 'TBD';
    const isFreilos = game.team1 === 'Freilos' || game.team2 === 'Freilos';
    
    let matchClasses = 'match';
    if (isFreilos) matchClasses += ' freilos';
    
    // Debug-Attribute
    const debugInfo = game.numericGameId ? `data-numeric-id="${game.numericGameId}"` : '';
    const bracketInfo = game.bracketSortOrder ? `data-bracket-sort="${game.bracketSortOrder}"` : '';
    const sortOrderInfo = `data-sort-order="${gameIndex + 1}"`;
    
    let html = `<div class="${matchClasses}" ${debugInfo} ${bracketInfo} ${sortOrderInfo} 
                     title="Game: ${game.gameId} | Numeric ID: ${game.numericGameId || 'N/A'} | Bracket Sort: ${game.bracketSortOrder || 'N/A'}">`;
    
    if (!hasResult && !isFreilos) {
        // Noch nicht gespielt
        html += renderTBDMatch(game);
    } else if (isFreilos) {
        // Freilos-Spiel
        html += renderFreilosMatch(game);
    } else {
        // Gespieltes Spiel mit Resultat
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
    
    // Team 1
    if (team1IsFreilos) {
        html += `<div class="team freilos-team"><span class="team-name">Freilos</span></div>`;
    } else {
        html += `<div class="team winner"><span class="team-name">${game.team1}</span></div>`;
    }
    
    // Team 2
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
    if (!game.result || !game.result.trim() || game.result === 'TBD') {
        return false;
    }
    
    const scores = parseScore(game.result);
    if (!scores) return false;
    
    const team1Score = parseInt(scores.team1) || 0;
    const team2Score = parseInt(scores.team2) || 0;
    
    if (team1Score === team2Score) return false;
    
    if (teamName === game.team1) {
        return team1Score > team2Score;
    } else if (teamName === game.team2) {
        return team2Score > team1Score;
    }
    
    return false;
}

function parseScore(resultString) {
    if (!resultString || resultString.trim() === '' || resultString === 'TBD') {
        return { team1: 'TBD', team2: 'TBD' };
    }
    
    const scoreMatch = resultString.match(/(\d+)[\s\-:]+(\d+)/);
    
    if (scoreMatch) {
        return {
            team1: scoreMatch[1],
            team2: scoreMatch[2]
        };
    }
    
    return { team1: resultString, team2: '' };
}

function adjustLongTeamNames() {
    const teamNames = document.querySelectorAll('.team-name');
    teamNames.forEach(nameElement => {
        const text = nameElement.textContent;
        if (text.length > 15 || text.includes(' ')) {
            nameElement.classList.add('long-name');
        }
    });
}

// Debug-Funktionen
function debugBracketSorting() {
    console.log('\n🔍 DEBUG: Current bracket sorting');
    currentRounds.forEach(([roundName, games]) => {
        console.log(`\n📊 Round: ${roundName}`);
        games.forEach((game, index) => {
            const bracketSort = game.bracketSortOrder || 'N/A';
            const numericId = game.numericGameId || 'N/A';
            console.log(`   ${index + 1}. ${game.team1} vs ${game.team2} | Bracket: ${bracketSort} | ID: ${numericId}`);
        });
    });
}

function showSortingInfo() {
    const gamesWithBracketSort = currentGames.filter(g => g.bracketSortOrder).length;
    const gamesWithNumericId = currentGames.filter(g => g.numericGameId).length;
    
    console.log(`📊 Sorting Info:`);
    console.log(`   Total games: ${currentGames.length}`);
    console.log(`   With bracketSortOrder: ${gamesWithBracketSort}`);
    console.log(`   With numericGameId: ${gamesWithNumericId}`);
    console.log(`   Bracket sort coverage: ${((gamesWithBracketSort / currentGames.length) * 100).toFixed(1)}%`);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Auto-load kann aktiviert werden falls gewünscht
    // loadBracket();
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        loadBracket();
    }
    
    if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        debugBracketSorting();
        showSortingInfo();
    }
});

// Globale Debug-Funktionen
window.debugBracketSorting = debugBracketSorting;
window.showSortingInfo = showSortingInfo;