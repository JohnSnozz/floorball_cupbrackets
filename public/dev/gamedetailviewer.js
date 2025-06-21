// gamedetailviewer.js - GameDetails Frontend Logic

let allGameDetails = [];
let filteredGameDetails = [];
let currentSort = { column: 'id', direction: 'asc' };

// Main loading function
async function loadAllGameDetails() {
    try {
        showLoading();
        showAlert('🔄 Lade GameDetails...', 'info');
        
        // Versuche zuerst die GameDetails API
        try {
            const response = await fetch('/api/game-details/all');
            if (response.ok) {
                const gameDetails = await response.json();
                console.log('API Response Type:', typeof gameDetails, 'Is Array:', Array.isArray(gameDetails));
                await loadWithGameDetailsAPI(gameDetails);
                return;
            }
        } catch (apiError) {
            console.log('GameDetails API nicht verfügbar, verwende Alternative:', apiError.message);
        }
        
        // Fallback: Nur Games anzeigen ohne Details
        await loadGamesOnly();
        
    } catch (error) {
        console.error('Error loading game details:', error);
        showAlert(`❌ Fehler: ${error.message}`, 'error');
        showNoData();
    }
}

// Load with GameDetails API
async function loadWithGameDetailsAPI(gameDetails) {
    try {
        // Debug: Prüfe was die API zurückgibt
        console.log('GameDetails API Response:', gameDetails);
        
        // Stelle sicher, dass gameDetails ein Array ist
        if (!Array.isArray(gameDetails)) {
            console.warn('GameDetails ist kein Array:', typeof gameDetails);
            // Fallback zu Games-Only Modus
            await loadGamesOnly();
            return;
        }
        
        // Lade Game-Infos für Verknüpfung
        const gamesResponse = await fetch('/games/all');
        const allGames = gamesResponse.ok ? await gamesResponse.json() : [];
        
        // Verknüpfe GameDetails mit Game-Infos
        allGameDetails = gameDetails.map(detail => {
            const gameInfo = allGames.find(game => game.numericGameId === detail.numericGameId);
            return {
                ...detail,
                gameInfo: gameInfo || {}
            };
        });
        
        filteredGameDetails = allGameDetails;
        displayGameDetails(filteredGameDetails);
        updateStats();
        showAlert(`✅ ${allGameDetails.length} GameDetails erfolgreich geladen`, 'success');
    } catch (error) {
        console.error('Error in loadWithGameDetailsAPI:', error);
        showAlert(`❌ Fehler beim Verknüpfen: ${error.message}`, 'error');
        // Fallback zu Games-Only Modus
        await loadGamesOnly();
    }
}

// Fallback: Load games only
async function loadGamesOnly() {
    try {
        // Zeige nur Games mit numericGameId (ohne DetailStats)
        const response = await fetch('/games/all');
        if (!response.ok) throw new Error(`Games Error: ${response.status}`);
        
        const allGames = await response.json();
        const gamesWithNumericId = allGames.filter(game => 
            game.numericGameId && 
            game.numericGameId !== '' &&
            game.team1.toLowerCase() !== 'freilos' &&
            game.team2.toLowerCase() !== 'freilos'
        );
        
        // Erstelle Pseudo-GameDetails nur mit verfügbaren Daten
        allGameDetails = gamesWithNumericId.map((game, index) => ({
            id: index + 1,
            numericGameId: game.numericGameId,
            totalEvents: '-',
            homeGoals: '-',
            awayGoals: '-', 
            penalties: '-',
            lastUpdated: 'N/A',
            eventData: null,
            gameInfo: game
        }));
        
        filteredGameDetails = allGameDetails;
        displayGameDetails(filteredGameDetails);
        updateStats();
        showAlert(`⚠️ ${allGameDetails.length} Games geladen (GameDetails API nicht verfügbar)`, 'info');
    } catch (error) {
        console.error('Error in loadGamesOnly:', error);
        throw error;
    }
}

// Refresh stats function
async function refreshStats() {
    try {
        showAlert('🔄 Aktualisiere Statistiken...', 'info');
        
        const response = await fetch('/api/game-details/stats');
        if (!response.ok) {
            // Fallback: Berechne Stats aus geladenen Daten
            updateStatsFromData();
            showAlert('⚠️ Stats aus geladenen Daten berechnet (API nicht verfügbar)', 'info');
            return;
        }
        
        const stats = await response.json();
        
        document.getElementById('statTotalGames').textContent = stats.totalGames || 0;
        document.getElementById('statTotalEvents').textContent = stats.totalEvents || 0;
        document.getElementById('statAvgGoals').textContent = stats.avgGoalsPerGame ? stats.avgGoalsPerGame.toFixed(2) : '0.00';
        document.getElementById('statAvgPenalties').textContent = stats.avgPenaltiesPerGame ? stats.avgPenaltiesPerGame.toFixed(2) : '0.00';
        
        showAlert('✅ Statistiken aktualisiert', 'success');
        
    } catch (error) {
        console.error('Error refreshing stats:', error);
        updateStatsFromData();
        showAlert(`⚠️ Stats-Fehler, Fallback verwendet: ${error.message}`, 'info');
    }
}

// Fallback stats calculation
function updateStatsFromData() {
    const total = allGameDetails.length;
    const totalEvents = allGameDetails.reduce((sum, detail) => {
        const events = detail.totalEvents;
        return sum + (typeof events === 'number' ? events : 0);
    }, 0);
    
    const totalGoals = allGameDetails.reduce((sum, detail) => {
        const home = detail.homeGoals;
        const away = detail.awayGoals;
        const homeNum = typeof home === 'number' ? home : 0;
        const awayNum = typeof away === 'number' ? away : 0;
        return sum + homeNum + awayNum;
    }, 0);
    
    const totalPenalties = allGameDetails.reduce((sum, detail) => {
        const penalties = detail.penalties;
        return sum + (typeof penalties === 'number' ? penalties : 0);
    }, 0);
    
    const avgGoals = total > 0 ? totalGoals / total : 0;
    const avgPenalties = total > 0 ? totalPenalties / total : 0;
    
    document.getElementById('statTotalGames').textContent = total;
    document.getElementById('statTotalEvents').textContent = totalEvents;
    document.getElementById('statAvgGoals').textContent = avgGoals.toFixed(2);
    document.getElementById('statAvgPenalties').textContent = avgPenalties.toFixed(2);
}

// Crawl GameDetails function
async function crawlGameDetails() {
    try {
        showAlert('🕷️ Starte GameDetails Crawling...', 'info');
        
        const response = await fetch('/api/crawl-game-details', {
            method: 'POST'
        });
        
        if (!response.ok) throw new Error(`Crawl Error: ${response.status}`);
        
        const result = await response.json();
        
        showAlert(`✅ Crawling abgeschlossen: ${result.success} erfolgreich, ${result.errors} Fehler`, 'success');
        
        // Nach dem Crawling automatisch neu laden
        setTimeout(() => {
            loadAllGameDetails();
        }, 2000);
        
    } catch (error) {
        console.error('Error crawling game details:', error);
        showAlert(`❌ Crawling-Fehler: ${error.message}`, 'error');
    }
}

// Display GameDetails in table
function displayGameDetails(gameDetails) {
    const tbody = document.getElementById('gameDetailsTableBody');
    if (!gameDetails || gameDetails.length === 0) { 
        showNoData(); 
        return; 
    }
    
    tbody.innerHTML = '';
    const displayDetails = gameDetails.slice(0, 500);
    
    displayDetails.forEach(detail => {
        const row = document.createElement('tr');
        const gameInfo = detail.gameInfo || {};
        
        row.innerHTML = `
            <td>${detail.id || ''}</td>
            <td title="${detail.numericGameId || ''}">${truncate(detail.numericGameId || '', 15)}</td>
            <td>${detail.totalEvents || '-'}</td>
            <td class="result">${detail.homeGoals || '-'}</td>
            <td class="result">${detail.awayGoals || '-'}</td>
            <td>${detail.penalties || '-'}</td>
            <td>${detail.lastUpdated && detail.lastUpdated !== 'N/A' ? new Date(detail.lastUpdated).toLocaleString('de-CH') : 'Invalid Date'}</td>
            <td>
                <button class="btn btn-info btn-small" onclick="showGameDetail('${detail.numericGameId}')">
                    👁️ Details
                </button>
            </td>
        `;
        
        // Tooltip mit Game-Info
        row.title = `${gameInfo.team1 || 'N/A'} vs ${gameInfo.team2 || 'N/A'} (${gameInfo.season || 'N/A'})`;
        
        tbody.appendChild(row);
    });
    
    if (gameDetails.length > 500) {
        const infoRow = document.createElement('tr');
        infoRow.innerHTML = `<td colspan="8" class="info-message">Zeige ersten 500 von ${gameDetails.length} GameDetails (Performance-Optimierung)</td>`;
        tbody.appendChild(infoRow);
    }
}

// Show game detail modal
async function showGameDetail(numericGameId) {
    try {
        // Versuche Details aus der bereits geladenen Liste zu finden
        const detail = allGameDetails.find(d => d.numericGameId === numericGameId);
        
        if (!detail) {
            showAlert(`❌ Game ${numericGameId} nicht in geladenen Daten gefunden`, 'error');
            return;
        }
        
        const gameInfo = detail.gameInfo || {};
        
        let content = `
            <div style="margin-bottom: 20px; padding: 15px; background: #333; border-radius: 6px;">
                <h4 style="color: #ff6b00; margin: 0 0 10px 0;">Game Information</h4>
                <p><strong>Teams:</strong> ${gameInfo.team1 || 'N/A'} vs ${gameInfo.team2 || 'N/A'}</p>
                <p><strong>Saison:</strong> ${gameInfo.season || 'N/A'}</p>
                <p><strong>Cup:</strong> ${gameInfo.cupType || 'N/A'}</p>
                <p><strong>Runde:</strong> ${gameInfo.roundName || 'N/A'}</p>
                <p><strong>Resultat:</strong> ${gameInfo.result || 'TBD'}</p>
                <p><strong>Numeric Game ID:</strong> ${numericGameId}</p>
                <p><strong>Database ID:</strong> ${detail.id || 'N/A'}</p>
            </div>
            
            <div style="margin-bottom: 20px; padding: 15px; background: #333; border-radius: 6px;">
                <h4 style="color: #ff6b00; margin: 0 0 10px 0;">Event Statistics</h4>
                <p><strong>Total Events:</strong> ${detail.totalEvents || 'N/A'}</p>
                <p><strong>Home Goals:</strong> ${detail.homeGoals || 'N/A'}</p>
                <p><strong>Away Goals:</strong> ${detail.awayGoals || 'N/A'}</p>
                <p><strong>Penalties:</strong> ${detail.penalties || 'N/A'}</p>
                <p><strong>Last Updated:</strong> ${detail.lastUpdated || 'N/A'}</p>
            </div>
        `;
        
        // Nur versuchen EventData zu laden wenn nicht bereits vorhanden
        if (detail.eventData && detail.eventData !== null) {
            // Event Data bereits geladen
            content += renderEventData(detail.eventData);
        } else {
            // Versuche Event Data von API zu laden
            content += `
                <div style="padding: 15px; background: #333; border-radius: 6px; text-align: center;">
                    <p style="color: #999; margin-bottom: 15px;">Event-Details können geladen werden...</p>
                    <button onclick="loadSingleGameDetail('${numericGameId}')" class="btn btn-info btn-small">
                        🔄 Event-Details laden
                    </button>
                </div>
            `;
        }
        
        document.getElementById('gameDetailContent').innerHTML = content;
        document.getElementById('gameDetailModal').style.display = 'block';
        
    } catch (error) {
        console.error('Error showing game detail:', error);
        showAlert(`❌ Detail-Fehler: ${error.message}`, 'error');
    }
}

// Load single game detail
async function loadSingleGameDetail(numericGameId) {
    try {
        showAlert('🔄 Lade Event-Details...', 'info');
        
        const response = await fetch(`/api/game-details/${numericGameId}`);
        if (!response.ok) {
            throw new Error(`GameDetails API nicht verfügbar (${response.status})`);
        }
        
        const detail = await response.json();
        
        if (detail.error) {
            showAlert(`⚠️ ${detail.error}`, 'info');
            return;
        }
        
        // Update des Modal-Inhalts mit echten Event-Details
        const eventDataHtml = renderEventData(detail.eventData);
        const modalContent = document.getElementById('gameDetailContent');
        const lastDiv = modalContent.lastElementChild;
        if (lastDiv) {
            lastDiv.innerHTML = eventDataHtml;
        }
        
        showAlert('✅ Event-Details geladen', 'success');
        
    } catch (error) {
        console.error('Error loading single game detail:', error);
        showAlert(`❌ Fehler beim Laden: ${error.message}`, 'error');
        
        // Zeige Fehlermeldung im Modal
        const modalContent = document.getElementById('gameDetailContent');
        const lastDiv = modalContent.lastElementChild;
        if (lastDiv) {
            lastDiv.innerHTML = `
                <div style="padding: 15px; background: #333; border-radius: 6px; text-align: center; color: #999;">
                    <p>❌ Event-Details konnten nicht geladen werden</p>
                    <p style="font-size: 11px; margin-top: 5px;">${error.message}</p>
                    <p style="font-size: 10px; margin-top: 10px; color: #666;">
                        Mögliche Ursachen: API nicht verfügbar, Game noch nicht gecrawlt, oder Netzwerkfehler
                    </p>
                </div>
            `;
        }
    }
}

// Render event data
function renderEventData(eventData) {
    if (!eventData) {
        return `<div style="padding: 15px; background: #333; border-radius: 6px; text-align: center; color: #999;">
            <p>Keine Event-Details verfügbar</p>
        </div>`;
    }
    
    let parsedEventData;
    try {
        parsedEventData = typeof eventData === 'string' ? JSON.parse(eventData) : eventData;
    } catch (e) {
        return `<div style="padding: 15px; background: #333; border-radius: 6px; text-align: center; color: #999;">
            <p>Event-Daten vorhanden, aber nicht parsebar</p>
            <details style="margin-top: 10px;">
                <summary style="cursor: pointer; color: #ff6b00;">Raw Event Data anzeigen</summary>
                <pre style="margin-top: 10px; padding: 10px; background: #1a1a1a; border-radius: 4px; font-size: 10px; overflow: auto; max-height: 200px;">${JSON.stringify(eventData, null, 2)}</pre>
            </details>
        </div>`;
    }
    
    if (parsedEventData && parsedEventData.data && parsedEventData.data.regions) {
        let content = `
            <div style="padding: 15px; background: #333; border-radius: 6px;">
                <h4 style="color: #ff6b00; margin: 0 0 10px 0;">Event Details</h4>
                <div style="max-height: 300px; overflow: auto; background: #1a1a1a; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 11px;">
        `;
        
        parsedEventData.data.regions.forEach((region, regionIndex) => {
            if (region.rows && region.rows.length > 0) {
                content += `<div style="margin-bottom: 10px;"><strong style="color: #ff6b00;">Region ${regionIndex + 1}:</strong></div>`;
                
                region.rows.forEach((row, rowIndex) => {
                    if (row.cells && row.cells.length >= 4) {
                        const time = row.cells[0]?.text?.[0] || '';
                        const event = row.cells[1]?.text?.[0] || '';
                        const team = row.cells[2]?.text?.[0] || '';
                        const player = row.cells[3]?.text?.[0] || '';
                        
                        content += `<div style="margin: 2px 0; padding: 4px; background: #2a2a2a; border-radius: 2px;">
                            <span style="color: #a8c5e0;">${time}</span> | 
                            <span style="color: #ffcc99;">${event}</span> | 
                            <span style="color: #99ffcc;">${team}</span> | 
                            <span style="color: #cccccc;">${player}</span>
                        </div>`;
                    }
                });
            }
        });
        
        content += `</div></div>`;
        return content;
    }
    
    return `<div style="padding: 15px; background: #333; border-radius: 6px; text-align: center; color: #999;">
        <p>Event-Daten in unbekanntem Format</p>
    </div>`;
}

// Close modal
function closeModal() {
    document.getElementById('gameDetailModal').style.display = 'none';
}

// Sort table
function sortTable(column, silent = false) {
    if (!silent) {
        if (currentSort.column === column) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.column = column;
            currentSort.direction = 'asc';
        }
    }

    const numericCols = ['id', 'numericGameId', 'totalEvents', 'homeGoals', 'awayGoals', 'penalties'];
    const sortedDetails = [...filteredGameDetails].sort((a, b) => {
        let valA = a[column] ?? '';
        let valB = b[column] ?? '';

        if (numericCols.includes(column)) {
            valA = parseInt(valA) || 0;
            valB = parseInt(valB) || 0;
        } else if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        }

        if (currentSort.direction === 'asc') return valA < valB ? -1 : valA > valB ? 1 : 0;
        return valA > valB ? -1 : valA < valB ? 1 : 0;
    });

    filteredGameDetails = sortedDetails;
    displayGameDetails(filteredGameDetails);

    if (!silent) updateSortHeaders();
}

// Update sort headers
function updateSortHeaders() {
    document.querySelectorAll('th .sort-icon').forEach(icon => {
        icon.textContent = '↕';
        icon.parentElement.classList.remove('sort-asc', 'sort-desc');
    });
    const currentHeader = document.querySelector(`th[onclick*="${currentSort.column}"]`);
    if (currentHeader) {
        const icon = currentHeader.querySelector('.sort-icon');
        if (icon) {
            icon.textContent = currentSort.direction === 'asc' ? '↑' : '↓';
            currentHeader.classList.add(`sort-${currentSort.direction}`);
        }
    }
}

// Update stats
function updateStats() {
    const total = allGameDetails.length;
    const totalEvents = allGameDetails.reduce((sum, detail) => {
        const events = detail.totalEvents;
        return sum + (typeof events === 'number' ? events : 0);
    }, 0);
    
    const totalGoals = allGameDetails.reduce((sum, detail) => {
        const home = detail.homeGoals;
        const away = detail.awayGoals;
        const homeNum = typeof home === 'number' ? home : 0;
        const awayNum = typeof away === 'number' ? away : 0;
        return sum + homeNum + awayNum;
    }, 0);
    
    const totalPenalties = allGameDetails.reduce((sum, detail) => {
        const penalties = detail.penalties;
        return sum + (typeof penalties === 'number' ? penalties : 0);
    }, 0);
    
    const avgGoals = total > 0 ? totalGoals / total : 0;
    const avgPenalties = total > 0 ? totalPenalties / total : 0;
    
    document.getElementById('statsInfo').innerHTML = `📊 ${total} GameDetails | ${totalEvents} Events | Ø ${avgGoals.toFixed(1)} Tore | Ø ${avgPenalties.toFixed(1)} Strafen`;
    
    // Update stats table
    document.getElementById('statTotalGames').textContent = total;
    document.getElementById('statTotalEvents').textContent = totalEvents;
    document.getElementById('statAvgGoals').textContent = avgGoals.toFixed(2);
    document.getElementById('statAvgPenalties').textContent = avgPenalties.toFixed(2);
}

// Filter table
function filterTable() {
    const inputs = Array.from(document.querySelectorAll('#filterRow input'));
    const filters = inputs.map(input => input.value.trim().toLowerCase());

    const filtered = allGameDetails.filter(detail => {
        const values = [
            detail.id,
            detail.numericGameId,
            detail.totalEvents,
            detail.homeGoals,
            detail.awayGoals,
            detail.penalties,
            detail.lastUpdated
        ];

        return values.every((value, index) => {
            const text = (value ?? '').toString().toLowerCase();
            return text.includes(filters[index]);
        });
    });
    
    filteredGameDetails = filtered;
    displayGameDetails(filtered);
    sortTable(currentSort.column, true);
}

// Utility functions
const showLoading = () => {
    const tbody = document.getElementById('gameDetailsTableBody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="8" class="loading">📊 Lade alle GameDetails…</td></tr>`;
    }
};

const showNoData = () => {
    const tbody = document.getElementById('gameDetailsTableBody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="8" class="no-data">🤷‍♂️ Keine GameDetails gefunden</td></tr>`;
    }
};

function showAlert(msg, type = 'info') {
    const c = document.getElementById('alertContainer');
    if (c) {
        c.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
        if (['success', 'info'].includes(type)) {
            setTimeout(() => c.innerHTML = '', 3000);
        }
    }
}

const truncate = (str, len) => (!str ? '' : str.length > len ? str.slice(0, len) + '…' : str);

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    refreshStats();
});

// ESC key to close modal
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeModal();
    }
});