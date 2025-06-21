// gamedetailviewer.js - GameDetails Frontend mit Season-Management

let allGameDetails = [];
let filteredGameDetails = [];
let currentSort = { column: null, direction: 'asc' };
let availableSeasons = [];
let seasonStats = [];
let currentSeasonFilter = '';
let pendingDeleteSeason = null;

// Alle Spalten aus der gameDetails Tabelle inkl. season
const ALL_COLUMNS = [
    'id',
    'numericGameId',
    'season',
    'home_name',
    'away_name',
    'home_logo',
    'away_logo',
    'result',
    'date',
    'time',
    'location',
    'location_x',
    'location_y',
    'first_referee',
    'second_referee',
    'spectators',
    'title',
    'subtitle',
    'lastUpdated'
];

// Load stats and seasons on page load
async function loadStats() {
    try {
        showAlert('🔄 Lade Statistiken und Seasons...', 'info');
        
        // Load general stats
        await refreshStats();
        
        // Load available seasons
        await loadAvailableSeasons();
        
        // Load season-specific stats
        await loadSeasonStats();
        
        showAlert('✅ Stats und Seasons geladen', 'success');
        
    } catch (error) {
        console.error('Error loading stats:', error);
        showAlert(`❌ Fehler beim Laden der Stats: ${error.message}`, 'error');
    }
}

// Load available seasons
async function loadAvailableSeasons() {
    try {
        const response = await fetch('/api/game-details/seasons');
        if (!response.ok) {
            throw new Error(`Seasons API Error: ${response.status}`);
        }
        
        availableSeasons = await response.json();
        console.log('Available seasons:', availableSeasons);
        
        // Update season filter dropdown
        updateSeasonFilter();
        
    } catch (error) {
        console.error('Error loading seasons:', error);
        availableSeasons = [];
    }
}

// Load season-specific statistics
async function loadSeasonStats() {
    try {
        const response = await fetch('/api/game-details/season-stats');
        if (!response.ok) {
            throw new Error(`Season Stats API Error: ${response.status}`);
        }
        
        seasonStats = await response.json();
        console.log('Season stats:', seasonStats);
        
        // Update season management UI
        updateSeasonManagement();
        
    } catch (error) {
        console.error('Error loading season stats:', error);
        seasonStats = [];
        updateSeasonManagement();
    }
}

// Update season filter dropdown
function updateSeasonFilter() {
    const select = document.getElementById('seasonFilter');
    if (!select) return;
    
    // Clear existing options except "Alle Seasons"
    select.innerHTML = '<option value="">Alle Seasons</option>';
    
    // Add season options
    availableSeasons.forEach(season => {
        const option = document.createElement('option');
        option.value = season;
        option.textContent = season;
        if (season === currentSeasonFilter) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

// Update season management grid
function updateSeasonManagement() {
    const grid = document.getElementById('seasonGrid');
    if (!grid) return;
    
    if (seasonStats.length === 0) {
        grid.innerHTML = `
            <div class="season-card">
                <h4>Keine Season-Daten</h4>
                <p class="season-stats">Keine GameDetails-Seasons in der Datenbank gefunden</p>
                <div class="season-actions">
                    <button class="btn btn-info btn-small" onclick="loadAvailableSeasons()">🔄 Neu laden</button>
                </div>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = '';
    
    seasonStats.forEach(stat => {
        const card = document.createElement('div');
        card.className = 'season-card';
        
        const lastUpdate = stat.lastUpdate ? 
            new Date(stat.lastUpdate).toLocaleDateString('de-CH') : 'Nie';
            
        card.innerHTML = `
            <h4>Season ${stat.season}</h4>
            <div class="season-stats">
                📊 ${stat.totalGames} Spiele total<br>
                ✅ ${stat.gamesWithResults} mit Resultat<br>
                🕐 Letztes Update: ${lastUpdate}
            </div>
            <div class="season-actions">
                <button class="btn btn-success btn-small" onclick="crawlSeason('${stat.season}')">
                    🕷️ Crawlen
                </button>
                <button class="btn btn-info btn-small" onclick="filterBySeason('${stat.season}')">
                    👁️ Anzeigen
                </button>
                <button class="btn btn-danger btn-small" onclick="showDeleteConfirm('${stat.season}')">
                    🗑️ Löschen
                </button>
            </div>
        `;
        
        grid.appendChild(card);
    });
    
    // Add cards for seasons without GameDetails
    availableSeasons.forEach(season => {
        const hasStats = seasonStats.some(stat => stat.season === season);
        if (!hasStats) {
            const card = document.createElement('div');
            card.className = 'season-card';
            card.style.borderLeftColor = '#6c757d';
            
            card.innerHTML = `
                <h4>Season ${season}</h4>
                <div class="season-stats">
                    🚫 Keine GameDetails vorhanden<br>
                    💡 Season kann gecrawlt werden
                </div>
                <div class="season-actions">
                    <button class="btn btn-warning btn-small" onclick="crawlSeason('${season}')">
                        🕷️ Crawlen
                    </button>
                </div>
            `;
            
            grid.appendChild(card);
        }
    });
}

// Filter by season
function filterBySeason(season = null) {
    if (season === null) {
        // Called from dropdown
        const select = document.getElementById('seasonFilter');
        season = select ? select.value : '';
    } else {
        // Called from season card
        const select = document.getElementById('seasonFilter');
        if (select) {
            select.value = season;
        }
    }
    
    currentSeasonFilter = season;
    
    if (season) {
        showAlert(`🔄 Lade GameDetails für Season ${season}...`, 'info');
        loadGameDetailsForSeason(season);
    } else {
        showAlert('🔄 Lade alle GameDetails...', 'info');
        loadAllGameDetails();
    }
    
    // Update filter info
    const filterInfo = document.getElementById('filterInfo');
    if (filterInfo) {
        if (season) {
            const stat = seasonStats.find(s => s.season === season);
            if (stat) {
                filterInfo.textContent = `${stat.totalGames} Spiele in Season ${season}`;
            } else {
                filterInfo.textContent = `Filter: Season ${season}`;
            }
        } else {
            filterInfo.textContent = 'Alle Seasons angezeigt';
        }
    }
}

// Load GameDetails for specific season
async function loadGameDetailsForSeason(season) {
    try {
        showLoading();
        
        const response = await fetch(`/api/game-details?season=${encodeURIComponent(season)}`);
        if (!response.ok) {
            throw new Error(`GameDetails API Error: ${response.status}`);
        }
        
        const gameDetails = await response.json();
        console.log(`Season ${season} GameDetails:`, gameDetails);
        
        if (!Array.isArray(gameDetails)) {
            throw new Error('GameDetails API gab kein Array zurück');
        }
        
        allGameDetails = gameDetails;
        filteredGameDetails = allGameDetails;
        
        createTableHeaders();
        displayGameDetails(filteredGameDetails);
        updateStatsFromData();
        showAlert(`✅ ${allGameDetails.length} GameDetails für Season ${season} geladen`, 'success');
        
    } catch (error) {
        console.error('Error loading season game details:', error);
        showAlert(`❌ Fehler: ${error.message}`, 'error');
        showNoData();
    }
}

// Main loading function - loads all data
async function loadAllGameDetails() {
    try {
        showLoading();
        showAlert('🔄 Lade alle GameDetails...', 'info');
        
        // Clear season filter
        currentSeasonFilter = '';
        const select = document.getElementById('seasonFilter');
        if (select) select.value = '';
        
        // Load ALL data without limit
        const response = await fetch('/api/game-details');
        if (!response.ok) {
            throw new Error(`GameDetails API Error: ${response.status}`);
        }
        
        const gameDetails = await response.json();
        console.log('All GameDetails API Response:', gameDetails);
        
        if (!Array.isArray(gameDetails)) {
            throw new Error('GameDetails API gab kein Array zurück');
        }
        
        allGameDetails = gameDetails;
        filteredGameDetails = allGameDetails;
        
        createTableHeaders();
        displayGameDetails(filteredGameDetails);
        updateStatsFromData();
        showAlert(`✅ ${allGameDetails.length} GameDetails erfolgreich geladen`, 'success');
        
        // Update filter info
        const filterInfo = document.getElementById('filterInfo');
        if (filterInfo) {
            filterInfo.textContent = 'Alle Seasons angezeigt';
        }
        
    } catch (error) {
        console.error('Error loading game details:', error);
        showAlert(`❌ Fehler: ${error.message}`, 'error');
        showNoData();
    }
}

// Crawl GameDetails for specific season
async function crawlSeason(season) {
    try {
        showAlert(`🕷️ Starte Crawling für Season ${season}...`, 'info');
        
        const response = await fetch(`/api/crawl-game-details/${encodeURIComponent(season)}`, {
            method: 'POST'
        });
        
        if (!response.ok) throw new Error(`Crawl Error: ${response.status}`);
        
        const result = await response.json();
        
        showAlert(`✅ Season ${season} Crawling: ${result.success} erfolgreich, ${result.errors} Fehler`, 'success');
        
        // Reload stats and current view
        setTimeout(async () => {
            await loadSeasonStats();
            if (currentSeasonFilter === season) {
                loadGameDetailsForSeason(season);
            }
        }, 2000);
        
    } catch (error) {
        console.error('Error crawling season:', error);
        showAlert(`❌ Crawling-Fehler für Season ${season}: ${error.message}`, 'error');
    }
}

// Show delete confirmation
function showDeleteConfirm(season) {
    pendingDeleteSeason = season;
    
    const stat = seasonStats.find(s => s.season === season);
    const gameCount = stat ? stat.totalGames : 0;
    
    document.getElementById('deleteConfirmText').innerHTML = `
        Möchtest du wirklich alle <strong>${gameCount} GameDetails</strong> für <strong>Season ${season}</strong> löschen?<br>
        <small style="color: #999;">Diese Aktion kann nicht rückgängig gemacht werden.</small>
    `;
    
    document.getElementById('confirmDeleteModal').style.display = 'block';
}

// Close delete modal
function closeDeleteModal() {
    document.getElementById('confirmDeleteModal').style.display = 'none';
    pendingDeleteSeason = null;
}

// Confirm delete
async function confirmDelete() {
    if (!pendingDeleteSeason) return;
    
    try {
        showAlert(`🗑️ Lösche Season ${pendingDeleteSeason}...`, 'info');
        
        const response = await fetch(`/api/game-details/season/${encodeURIComponent(pendingDeleteSeason)}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error(`Delete Error: ${response.status}`);
        
        const result = await response.json();
        
        showAlert(`✅ ${result.deleted} GameDetails für Season ${pendingDeleteSeason} gelöscht`, 'success');
        
        // Close modal
        closeDeleteModal();
        
        // Reload stats and clear current view if showing deleted season
        setTimeout(async () => {
            await loadSeasonStats();
            if (currentSeasonFilter === pendingDeleteSeason) {
                currentSeasonFilter = '';
                const select = document.getElementById('seasonFilter');
                if (select) select.value = '';
                showNoData();
            }
        }, 1000);
        
    } catch (error) {
        console.error('Error deleting season:', error);
        showAlert(`❌ Lösch-Fehler: ${error.message}`, 'error');
    }
}

// Create table headers - now includes season column
function createTableHeaders() {
    const thead = document.getElementById('tableHead');
    thead.innerHTML = '';
    
    // Filter row
    const filterRow = document.createElement('tr');
    filterRow.id = 'filterRow';
    ALL_COLUMNS.forEach(col => {
        const th = document.createElement('th');
        th.innerHTML = `<input type="text" placeholder="${col}" oninput="filterTable()" style="width: 100%; background: #444; border: 1px solid #666; color: #fff; padding: 4px; border-radius: 2px;">`;
        filterRow.appendChild(th);
    });
    // Actions column
    const actionsFilterTh = document.createElement('th');
    actionsFilterTh.innerHTML = '<span>Actions</span>';
    filterRow.appendChild(actionsFilterTh);
    
    // Header row
    const headerRow = document.createElement('tr');
    ALL_COLUMNS.forEach(col => {
        const th = document.createElement('th');
        th.onclick = () => sortTable(col);
        th.innerHTML = `${col} <span class="sort-icon">↕</span>`;
        headerRow.appendChild(th);
    });
    // Actions column
    const actionsTh = document.createElement('th');
    actionsTh.textContent = 'Actions';
    headerRow.appendChild(actionsTh);
    
    thead.appendChild(filterRow);
    thead.appendChild(headerRow);
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
        
        ALL_COLUMNS.forEach(col => {
            const td = document.createElement('td');
            let value = detail[col];
            
            // Format specific columns
            if (col === 'date' && value) {
                try {
                    const date = new Date(value);
                    value = date.toLocaleDateString('de-CH');
                } catch (e) {
                    // Keep original value
                }
            } else if (col === 'lastUpdated' && value) {
                try {
                    const date = new Date(value);
                    value = date.toLocaleString('de-CH');
                } catch (e) {
                    // Keep original value
                }
            } else if ((col === 'location_x' || col === 'location_y') && value !== null && value !== undefined) {
                value = parseFloat(value).toFixed(6);
            } else if ((col === 'home_logo' || col === 'away_logo') && value && value.length > 30) {
                // Truncate long URLs for table display
                value = value.substring(0, 30) + '...';
            }
            
            td.textContent = value !== null && value !== undefined && value !== '' ? value : '-';
            td.title = detail[col] || ''; // Full value in tooltip
            
            // Special styling
            if (col === 'result' && value && value !== '-') {
                td.className = 'result';
            } else if (col === 'season' && value) {
                td.style.fontWeight = '600';
                td.style.color = '#ff6b00';
            }
            
            row.appendChild(td);
        });
        
        // Actions column
        const actionsTd = document.createElement('td');
        actionsTd.innerHTML = `
            <button class="btn btn-info btn-small" onclick="showGameDetail('${detail.numericGameId}')">
                👁️ Details
            </button>
        `;
        row.appendChild(actionsTd);
        
        tbody.appendChild(row);
    });
    
    if (gameDetails.length > 500) {
        const infoRow = document.createElement('tr');
        infoRow.innerHTML = `<td colspan="${ALL_COLUMNS.length + 1}" class="info-message">Zeige ersten 500 von ${gameDetails.length} GameDetails (Performance-Optimierung)</td>`;
        tbody.appendChild(infoRow);
    }
}

// Enhanced CSV Export function
async function exportToCSV() {
    if (!allGameDetails || allGameDetails.length === 0) {
        showAlert('❌ Keine Daten zum Exportieren vorhanden', 'error');
        return;
    }
    
    try {
        const exportData = filteredGameDetails.length > 0 ? filteredGameDetails : allGameDetails;
        showAlert(`🔄 Exportiere ${exportData.length} GameDetails als CSV...`, 'info');
        
        // Include all columns for export
        const exportColumns = [...ALL_COLUMNS];
        
        // Create CSV header
        const csvHeaders = exportColumns.join(',');
        
        // Process data in chunks
        const chunkSize = 1000;
        let csvRows = [];
        
        for (let i = 0; i < exportData.length; i += chunkSize) {
            const chunk = exportData.slice(i, i + chunkSize);
            const chunkRows = chunk.map(detail => {
                return exportColumns.map(col => {
                    let value = detail[col];
                    
                    if (value === null || value === undefined) {
                        return '';
                    }
                    
                    value = String(value);
                    value = value.replace(/"/g, '""');
                    
                    if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes(';')) {
                        value = `"${value}"`;
                    }
                    
                    return value;
                }).join(',');
            });
            
            csvRows = csvRows.concat(chunkRows);
            
            // Show progress for large exports
            if (exportData.length > 5000 && i % (chunkSize * 5) === 0) {
                const progress = Math.round((i / exportData.length) * 100);
                showAlert(`🔄 Export Fortschritt: ${progress}%`, 'info');
                setTimeout(() => {}, 10);
            }
        }
        
        // Combine header and rows
        const csvContent = [csvHeaders, ...csvRows].join('\n');
        const BOM = '\uFEFF';
        const csvWithBOM = BOM + csvContent;
        
        // Create and download file
        const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        
        // Generate filename with timestamp and filter info
        const timestamp = new Date().toISOString().slice(0,19).replace(/:/g, '-');
        const seasonSuffix = currentSeasonFilter ? `_${currentSeasonFilter}` : '';
        link.setAttribute('download', `gamedetails_export${seasonSuffix}_${exportData.length}_${timestamp}.csv`);
        
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        const filterText = currentSeasonFilter ? ` (Season ${currentSeasonFilter})` : '';
        showAlert(`✅ CSV mit ${exportData.length} Einträgen${filterText} erfolgreich exportiert`, 'success');
        
    } catch (error) {
        console.error('CSV Export Error:', error);
        showAlert(`❌ CSV Export Fehler: ${error.message}`, 'error');
    }
}

// Refresh stats function
async function refreshStats() {
    try {
        const response = await fetch('/api/game-details/stats');
        if (!response.ok) {
            throw new Error(`Stats API Error: ${response.status}`);
        }
        
        const stats = await response.json();
        console.log('Stats API Response:', stats);
        
        document.getElementById('statTotalGames').textContent = stats.totalGames || 0;
        document.getElementById('statGamesWithResults').textContent = stats.gamesWithResults || 0;
        document.getElementById('statGamesWithSpectators').textContent = stats.gamesWithSpectators || 0;
        document.getElementById('statAvgSpectators').textContent = 
            stats.avgSpectators ? stats.avgSpectators.toFixed(0) : '0';
        document.getElementById('statGamesWithReferees').textContent = stats.gamesWithReferees || 0;
        
    } catch (error) {
        console.error('Error refreshing stats:', error);
        updateStatsFromData();
    }
}

// Fallback stats calculation
function updateStatsFromData() {
    const total = allGameDetails.length;
    const withResults = allGameDetails.filter(d => d.result && d.result.trim() !== '').length;
    const withSpectators = allGameDetails.filter(d => d.spectators && d.spectators > 0).length;
    const withReferees = allGameDetails.filter(d => d.first_referee && d.first_referee.trim() !== '').length;
    
    const totalSpectators = allGameDetails.reduce((sum, d) => {
        return sum + (d.spectators || 0);
    }, 0);
    
    const avgSpectators = withSpectators > 0 ? totalSpectators / withSpectators : 0;
    
    document.getElementById('statTotalGames').textContent = total;
    document.getElementById('statGamesWithResults').textContent = withResults;
    document.getElementById('statGamesWithSpectators').textContent = withSpectators;
    document.getElementById('statAvgSpectators').textContent = avgSpectators.toFixed(0);
    document.getElementById('statGamesWithReferees').textContent = withReferees;
    
    // Update stats info
    const seasonText = currentSeasonFilter ? ` (Season ${currentSeasonFilter})` : '';
    document.getElementById('statsInfo').innerHTML = 
        `📊 ${total} GameDetails${seasonText} | ${withResults} mit Resultat | ${withSpectators} mit Zuschauern`;
}

// Show game detail modal - includes season info
async function showGameDetail(numericGameId) {
    try {
        const detail = allGameDetails.find(d => d.numericGameId === numericGameId);
        
        if (!detail) {
            showAlert(`❌ Game ${numericGameId} nicht in geladenen Daten gefunden`, 'error');
            return;
        }
        
        let content = `
            <div style="margin-bottom: 20px; padding: 15px; background: #333; border-radius: 6px;">
                <h4 style="color: #ff6b00; margin: 0 0 15px 0;">Game Information</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        `;
        
        // Display all columns
        ALL_COLUMNS.forEach(col => {
            let value = detail[col];
            
            // Format specific values for display
            if (col === 'date' && value) {
                try {
                    value = new Date(value).toLocaleDateString('de-CH');
                } catch (e) {}
            } else if (col === 'lastUpdated' && value) {
                try {
                    value = new Date(value).toLocaleString('de-CH');
                } catch (e) {}
            } else if ((col === 'location_x' || col === 'location_y') && value !== null && value !== undefined) {
                value = parseFloat(value).toFixed(6);
            }
            
            const displayValue = value !== null && value !== undefined && value !== '' ? value : 'N/A';
            
            // Special handling for logo URLs
            if ((col === 'home_logo' || col === 'away_logo') && value && value !== 'N/A') {
                content += `
                    <div>
                        <p><strong>${col}:</strong></p>
                        <img src="${value}" alt="${col}" style="max-width: 60px; max-height: 60px; border-radius: 4px; margin-top: 5px;"
                             onerror="this.style.display='none'; this.nextSibling.style.display='block';">
                        <div style="display:none; padding: 5px; background: #555; border-radius: 4px; color: #999; font-size: 10px;">${value}</div>
                    </div>
                `;
            } else {
                // Highlight season
                const style = col === 'season' ? 'color: #ff6b00; font-weight: 600;' : '';
                content += `<p><strong style="${style}">${col}:</strong> <span style="${style}">${displayValue}</span></p>`;
            }
        });
        
        content += `
                </div>
            </div>
        `;
        
        // Raw Data if available
        if (detail.rawData) {
            content += `
                <div style="padding: 15px; background: #333; border-radius: 6px;">
                    <h4 style="color: #ff6b00; margin: 0 0 10px 0;">Raw API Data</h4>
                    <details>
                        <summary style="cursor: pointer; color: #ff6b00;">API Raw Data anzeigen</summary>
                        <pre style="margin-top: 10px; padding: 10px; background: #1a1a1a; border-radius: 4px; font-size: 10px; overflow: auto; max-height: 300px;">${detail.rawData}</pre>
                    </details>
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

    const numericCols = ['id', 'spectators', 'location_x', 'location_y'];
    const sortedDetails = [...filteredGameDetails].sort((a, b) => {
        let valA = a[column] ?? '';
        let valB = b[column] ?? '';

        if (numericCols.includes(column)) {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
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
    
    const headers = document.querySelectorAll('thead tr:last-child th');
    const columnIndex = ALL_COLUMNS.indexOf(currentSort.column);
    if (columnIndex >= 0 && headers[columnIndex]) {
        const icon = headers[columnIndex].querySelector('.sort-icon');
        if (icon) {
            icon.textContent = currentSort.direction === 'asc' ? '↑' : '↓';
            headers[columnIndex].classList.add(`sort-${currentSort.direction}`);
        }
    }
}

// Filter table
function filterTable() {
    const inputs = Array.from(document.querySelectorAll('#filterRow input'));
    const filters = inputs.map(input => input.value.trim().toLowerCase());

    const filtered = allGameDetails.filter(detail => {
        return ALL_COLUMNS.every((col, index) => {
            const value = (detail[col] ?? '').toString().toLowerCase();
            return value.includes(filters[index] || '');
        });
    });
    
    filteredGameDetails = filtered;
    displayGameDetails(filtered);
    if (currentSort.column) {
        sortTable(currentSort.column, true);
    }
}

// Utility functions
const showLoading = () => {
    const tbody = document.getElementById('gameDetailsTableBody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="${ALL_COLUMNS.length + 1}" class="loading">📊 Lade GameDetails…</td></tr>`;
    }
};

const showNoData = () => {
    const tbody = document.getElementById('gameDetailsTableBody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="${ALL_COLUMNS.length + 1}" class="no-data">🤷‍♂️ Keine GameDetails gefunden</td></tr>`;
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

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    loadStats();
});

// ESC key to close modals
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeModal();
        closeDeleteModal();
    }
});