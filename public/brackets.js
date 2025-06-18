// Neues brackets.js - NUR bracketSortOrder, keine Fallbacks

let currentGames = [];
let currentRounds = [];

/**
 * Einheitliche Runden-Priorität für chronologische Sortierung
 * Niedrigere Zahl = frühere Runde, höhere Zahl = spätere Runde
 */
function getUnifiedRoundPriority(roundName) {
    const name = roundName.toLowerCase().trim();

    // 1/X Format - direkt als Priorität verwenden (1/128 = früh, 1/1 = spät)
    const fractionMatch = name.match(/^1\/(\d+)$/);
    if (fractionMatch) {
        const denominator = parseInt(fractionMatch[1]);
        // Umkehrung: je kleiner der Nenner, desto später die Runde
        // 1/128 → 1, 1/64 → 2, 1/32 → 3, ..., 1/1 → 8
        return Math.log2(128) - Math.log2(denominator) + 1;
    }

    // Deutsche Rundennamen
    if (name.includes('finale') && !name.includes('halb') && !name.includes('viertel') && !name.includes('achtel')) {
        return 8; // Finale = späteste Runde
    }
    if (name.includes('halbfinale')) return 7;
    if (name.includes('viertelfinale')) return 6;
    if (name.includes('achtelfinale')) return 5;

    // Numerische Runden (1. Runde, 2. Runde, etc.)
    const numberMatch = name.match(/(\d+)\./);
    if (numberMatch) {
        return parseInt(numberMatch[1]);
    }

    // Fallback für unbekannte Runden
    return 1000;
}

/**
 * Vereinheitlichte getRoundValue Funktion
 */
function getRoundValue(roundName) {
    return getUnifiedRoundPriority(roundName);
}

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
        
        // Prüfe ob bracketSortOrder verfügbar ist
        const bracketSortingValidation = validateBracketSorting(games);
        if (!bracketSortingValidation.isValid) {
            bracketContent.innerHTML = `
                <div class="error">
                    ❌ <strong>Bracket-Sortierung nicht verfügbar!</strong><br><br>
                    ${bracketSortingValidation.message}<br><br>
                    <strong>Lösungsschritte:</strong><br>
                    1. Führe zuerst die Bracket-Sortierung aus: <code>POST /calculate-bracket-sorting</code><br>
                    2. Oder verwende den Auto-Crawl Modus beim Server-Start<br>
                    3. Stelle sicher, dass alle Spiele bracketSortOrder-Werte haben
                </div>
            `;
            return;
        }
        
        // Gruppiere und sortiere Spiele nach Runden (nur mit bracketSortOrder)
        const processedRounds = processGamesByRounds(games);
        currentRounds = processedRounds;
        
        infoBox.innerHTML = `📊 ${games.length} Spiele in ${currentRounds.length} Runden geladen (bracketSortOrder: ✅)`;
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

/**
 * Validiert ob bracketSortOrder für alle Spiele verfügbar ist
 */
function validateBracketSorting(games) {
    const gamesWithBracketSort = games.filter(g => 
        g.bracketSortOrder !== undefined && 
        g.bracketSortOrder !== null && 
        g.bracketSortOrder !== ''
    );
    
    const coverage = games.length > 0 ? (gamesWithBracketSort.length / games.length) * 100 : 0;
    
    console.log(`🔍 Bracket sorting validation:`);
    console.log(`   Total games: ${games.length}`);
    console.log(`   Games with bracketSortOrder: ${gamesWithBracketSort.length}`);
    console.log(`   Coverage: ${coverage.toFixed(1)}%`);
    
    if (coverage < 100) {
        return {
            isValid: false,
            message: `Nur ${gamesWithBracketSort.length}/${games.length} Spiele (${coverage.toFixed(1)}%) haben bracketSortOrder-Werte. Alle Spiele müssen bracketSortOrder haben.`
        };
    }
    
    return {
        isValid: true,
        message: `Alle ${games.length} Spiele haben bracketSortOrder-Werte.`
    };
}

function processGamesByRounds(games) {
    console.log('🎯 Processing games with STRICT bracket-based sorting (no fallbacks)...');
    
    // Gruppiere nach Runden
    const roundsMap = new Map();
    games.forEach(game => {
        const roundName = game.roundName || 'Unbekannte Runde';
        if (!roundsMap.has(roundName)) {
            roundsMap.set(roundName, []);
        }
        roundsMap.get(roundName).push(game);
    });
    
    // Sortiere Runden chronologisch (früh zu spät) für Frontend-Anzeige
    const sortedRounds = Array.from(roundsMap.entries()).sort((a, b) => {
        const aValue = getRoundValue(a[0]);
        const bValue = getRoundValue(b[0]);
        console.log(`🔄 Round comparison: "${a[0]}" (${aValue}) vs "${b[0]}" (${bValue})`);
        return aValue - bValue; // Aufsteigende Sortierung für Frontend
    });
    
    // Sortiere Spiele innerhalb jeder Runde STRIKT nach bracketSortOrder
    const processedRounds = sortedRounds.map(([roundName, roundGames]) => {
        console.log(`\n📊 Processing round: ${roundName} (${roundGames.length} games)`);
        
        const sortedGames = sortGamesByBracketSortOrderOnly(roundGames, roundName);
        
        console.log(`✅ Sorted ${sortedGames.length} games by bracketSortOrder only`);
        sortedGames.forEach((game, index) => {
            const bracketSort = game.bracketSortOrder;
            const preview = `${game.team1} vs ${game.team2}`.substring(0, 25);
            console.log(`   ${index + 1}. ${preview} (bracketSortOrder: ${bracketSort})`);
        });
        
        return [roundName, sortedGames];
    });
    
    console.log(`🎯 Final bracket structure: ${processedRounds.length} rounds processed (bracketSortOrder only)`);
    return processedRounds;
}

/**
 * Sortiert Spiele STRIKT nach bracketSortOrder - KEINE Fallbacks!
 */
function sortGamesByBracketSortOrderOnly(games, roundName) {
    console.log(`🎯 Sorting ${games.length} games in round "${roundName}" by bracketSortOrder ONLY`);
    
    // Prüfe ob ALLE Spiele bracketSortOrder haben
    const gamesWithoutBracketSort = games.filter(game => 
        game.bracketSortOrder === undefined || 
        game.bracketSortOrder === null || 
        game.bracketSortOrder === ''
    );
    
    if (gamesWithoutBracketSort.length > 0) {
        console.error(`❌ FEHLER: ${gamesWithoutBracketSort.length} Spiele in Runde "${roundName}" haben keine bracketSortOrder!`);
        gamesWithoutBracketSort.forEach(game => {
            console.error(`   - Game ${game.gameId}: ${game.team1} vs ${game.team2} (bracketSortOrder: ${game.bracketSortOrder})`);
        });
        
        throw new Error(`Runde "${roundName}": ${gamesWithoutBracketSort.length} von ${games.length} Spielen haben keine bracketSortOrder-Werte. Führe zuerst die Bracket-Sortierung aus: POST /calculate-bracket-sorting`);
    }
    
    // Sortiere NUR nach bracketSortOrder
    const sorted = games.sort((a, b) => {
        const sortA = parseInt(a.bracketSortOrder, 10);
        const sortB = parseInt(b.bracketSortOrder, 10);
        
        if (isNaN(sortA) || isNaN(sortB)) {
            throw new Error(`Ungültige bracketSortOrder-Werte gefunden: Game ${a.gameId} (${a.bracketSortOrder}) vs Game ${b.gameId} (${b.bracketSortOrder})`);
        }
        
        return sortA - sortB;
    });
    
    // Debug-Ausgabe
    console.log(`📋 Sorted games in "${roundName}" by bracketSortOrder:`);
    sorted.forEach((game, index) => {
        console.log(`   ${index + 1}. ${game.team1} vs ${game.team2} → bracketSortOrder: ${game.bracketSortOrder}`);
    });
    
    return sorted;
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
    
    // Debug-Attribute - jetzt nur noch bracketSortOrder relevant
    const bracketInfo = `data-bracket-sort="${game.bracketSortOrder}"`;
    const sortOrderInfo = `data-sort-order="${gameIndex + 1}"`;
    
    let html = `<div class="${matchClasses}" ${bracketInfo} ${sortOrderInfo} 
                     title="Game: ${game.gameId} | bracketSortOrder: ${game.bracketSortOrder}">`;
    
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
    
    html += `
    <a class="match-link" href="https://www.swissunihockey.ch/de/game-detail?&game_id=${game.numericGameId}" 
       target="_blank" title="Spiel-Details ansehen">
    </a>
    </div>`;
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
    console.log('\n🔍 DEBUG: Current bracket sorting (bracketSortOrder only)');
    currentRounds.forEach(([roundName, games]) => {
        console.log(`\n📊 Round: ${roundName}`);
        games.forEach((game, index) => {
            const bracketSort = game.bracketSortOrder;
            console.log(`   ${index + 1}. ${game.team1} vs ${game.team2} | bracketSortOrder: ${bracketSort}`);
        });
    });
}

function showSortingInfo() {
    const gamesWithBracketSort = currentGames.filter(g => 
        g.bracketSortOrder !== undefined && 
        g.bracketSortOrder !== null && 
        g.bracketSortOrder !== ''
    ).length;
    
    console.log(`📊 Sorting Info (STRICT bracketSortOrder only):`);
    console.log(`   Total games: ${currentGames.length}`);
    console.log(`   With bracketSortOrder: ${gamesWithBracketSort}`);
    console.log(`   Coverage: ${((gamesWithBracketSort / currentGames.length) * 100).toFixed(1)}%`);
    console.log(`   Status: ${gamesWithBracketSort === currentGames.length ? '✅ READY' : '❌ INCOMPLETE'}`);
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
window.getUnifiedRoundPriority = getUnifiedRoundPriority;