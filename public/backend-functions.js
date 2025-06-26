// backend-functions.js - Alle Backend-Funktionen für Dashboard

// ========== UTILITY FUNCTIONS ==========

function updateBackendStatus(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = `backend-status ${type}`;
    }
}

async function checkStatus() {
    try {
        // Auth Status prüfen
        const authResponse = await fetch('/dev/status');
        const authData = await authResponse.json();
        
        document.getElementById('loginTime').textContent = 
            authData.loginTime ? new Date(authData.loginTime).toLocaleString() : 'Unbekannt';
        
        // Server Health prüfen
        const healthResponse = await fetch('/health');
        const healthData = await healthResponse.json();
        
        document.getElementById('serverStatus').textContent = 
            healthData.status === 'OK' ? '🟢 Online' : '🔴 Error';
        document.getElementById('uptime').textContent = 
            healthData.uptime ? Math.floor(healthData.uptime / 60) + ' Min' : 'Unknown';
        
        // API Stats laden
        const statsResponse = await fetch('/api/stats');
        const statsData = await statsResponse.json();
        
        if (statsData.currentSeason) {
            document.getElementById('totalGames').textContent = 
                statsData.currentSeason.totalGames || '0';
        }
        
        // Game Details Stats laden
        try {
            const gameDetailsStatsResponse = await fetch('/api/game-details/stats');
            const gameDetailsStats = await gameDetailsStatsResponse.json();
            document.getElementById('gameDetailsCount').textContent = 
                gameDetailsStats.totalgames || '0';
        } catch (e) {
            document.getElementById('gameDetailsCount').textContent = '-';
        }
        
        // Game Events Stats laden
        try {
            const gameEventsStatsResponse = await fetch('/api/game-events/stats');
            const gameEventsStats = await gameEventsStatsResponse.json();
            document.getElementById('gameEventsCount').textContent = 
                gameEventsStats.totalevents || '0';
        } catch (e) {
            document.getElementById('gameEventsCount').textContent = '-';
        }
        
        // Bracket Status laden
        try {
            const bracketResponse = await fetch('/bracket-sorting-status');
            const bracketData = await bracketResponse.json();
            const totalSorted = bracketData.events ? 
                bracketData.events.reduce((sum, event) => sum + parseInt(event.sortedGames || 0), 0) : 0;
            document.getElementById('bracketSorted').textContent = totalSorted;
        } catch (e) {
            document.getElementById('bracketSorted').textContent = '-';
        }
        
    } catch (error) {
        console.error('Status check failed:', error);
        document.getElementById('loginTime').textContent = 'Fehler beim Laden';
        document.getElementById('serverStatus').textContent = '🔴 Verbindungsfehler';
        document.getElementById('uptime').textContent = 'Unknown';
    }
}

async function logout() {
    if (confirm('Wirklich ausloggen?')) {
        try {
            await fetch('/dev/logout', { method: 'POST' });
            window.location.href = '/dev/login';
        } catch (error) {
            alert('Logout fehlgeschlagen. Bitte versuchen Sie es erneut.');
        }
    }
}

// ========== BACKEND API FUNCTIONS ==========

async function executeQuickUpdate() {
    updateBackendStatus('quickUpdateStatus', '⏳ Quick Update wird ausgeführt...', 'loading');
    
    try {
        const response = await fetch('/api/backend/quick-update', {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            updateBackendStatus('quickUpdateStatus', `✅ Quick Update erfolgreich: ${result.summary}`, 'success');
            // Status nach erfolgreichem Update aktualisieren
            setTimeout(checkStatus, 2000);
        } else {
            updateBackendStatus('quickUpdateStatus', `❌ Fehler: ${result.error}`, 'error');
        }
    } catch (error) {
        updateBackendStatus('quickUpdateStatus', `❌ Verbindungsfehler: ${error.message}`, 'error');
    }
}

async function executeCrawling() {
    const season = document.getElementById('crawlSeasonSelect').value;
    updateBackendStatus('crawlingStatus', `⏳ Crawling ${season} wird ausgeführt...`, 'loading');
    
    try {
        const endpoint = season === 'all' ? '/api/backend/crawl-all' : '/api/backend/crawl-season';
        const body = season === 'all' ? {} : { season };
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        const result = await response.json();
        
        if (result.success) {
            updateBackendStatus('crawlingStatus', `✅ Crawling abgeschlossen: ${result.summary}`, 'success');
            setTimeout(checkStatus, 2000);
        } else {
            updateBackendStatus('crawlingStatus', `❌ Fehler: ${result.error}`, 'error');
        }
    } catch (error) {
        updateBackendStatus('crawlingStatus', `❌ Verbindungsfehler: ${error.message}`, 'error');
    }
}

async function executeCupDataDelete() {
    const season = document.getElementById('crawlSeasonSelect').value;
    
    if (season === 'all') {
        updateBackendStatus('crawlingStatus', '❌ Löschung für "alle Saisons" nicht verfügbar', 'error');
        return;
    }
    
    if (!confirm(`Cup-Daten für Season ${season} wirklich löschen?\n\nDies löscht alle Cup-Spiele (außer Prognose) für diese Season.`)) {
        return;
    }
    
    updateBackendStatus('crawlingStatus', `⏳ Cup-Daten für Season ${season} werden gelöscht...`, 'loading');
    
    try {
        const response = await fetch(`/api/backend/cup-data/season/${encodeURIComponent(season)}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            updateBackendStatus('crawlingStatus', `✅ Season ${season} gelöscht: ${result.deleted} Cup-Spiele entfernt`, 'success');
            setTimeout(checkStatus, 2000);
        } else {
            updateBackendStatus('crawlingStatus', `❌ Fehler: ${result.error}`, 'error');
        }
    } catch (error) {
        updateBackendStatus('crawlingStatus', `❌ Verbindungsfehler: ${error.message}`, 'error');
    }
}

async function executeTeamshortsUpload() {
    const fileInput = document.getElementById('teamshortsCsv');
    if (fileInput.files.length === 0) {
        updateBackendStatus('teamshortsStatus', '❌ Bitte eine CSV-Datei auswählen', 'error');
        return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('csv', file);

    updateBackendStatus('teamshortsStatus', '⏳ CSV wird hochgeladen und synchronisiert...', 'loading');

    try {
        const response = await fetch('/api/backend/teamshorts-sync', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            updateBackendStatus('teamshortsStatus', '✅ Synchronisation erfolgreich abgeschlossen', 'success');
            fileInput.value = ''; // Input leeren
        } else {
            updateBackendStatus('teamshortsStatus', `❌ Fehler: ${result.error}`, 'error');
        }
    } catch (error) {
        updateBackendStatus('teamshortsStatus', `❌ Verbindungsfehler: ${error.message}`, 'error');
    }
}

async function executeBracketSorting() {
    const season = document.getElementById('bracketSeasonSelect').value;
    updateBackendStatus('bracketStatus', `⏳ Bracket-Sortierung ${season} wird berechnet...`, 'loading');
    
    try {
        const endpoint = season === 'all' ? '/api/backend/bracket-all' : '/api/backend/bracket-season';
        const body = season === 'all' ? {} : { season };
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        const result = await response.json();
        
        if (result.success) {
            updateBackendStatus('bracketStatus', '✅ Bracket-Sortierung erfolgreich berechnet', 'success');
            setTimeout(checkStatus, 2000);
        } else {
            updateBackendStatus('bracketStatus', `❌ Fehler: ${result.error}`, 'error');
        }
    } catch (error) {
        updateBackendStatus('bracketStatus', `❌ Verbindungsfehler: ${error.message}`, 'error');
    }
}

async function executeBracketReset() {
    const season = document.getElementById('bracketSeasonSelect').value;
    
    if (!confirm(`Bracket-Sortierung für Season ${season} wirklich zurücksetzen?`)) {
        return;
    }
    
    updateBackendStatus('bracketStatus', `⏳ Bracket-Sortierung für Season ${season} wird zurückgesetzt...`, 'loading');
    
    try {
        const response = await fetch(`/api/backend/bracket-sorting/season/${encodeURIComponent(season)}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            updateBackendStatus('bracketStatus', `✅ Season ${season}: ${result.updated} Spiele zurückgesetzt`, 'success');
            setTimeout(checkStatus, 2000);
        } else {
            updateBackendStatus('bracketStatus', `❌ Fehler: ${result.error}`, 'error');
        }
    } catch (error) {
        updateBackendStatus('bracketStatus', `❌ Verbindungsfehler: ${error.message}`, 'error');
    }
}

async function executePrognoseCleanup() {
    updateBackendStatus('prognoseStatus', '⏳ Prognose-Spiele werden gelöscht...', 'loading');
    
    try {
        const response = await fetch('/api/backend/prognose-cleanup', {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            updateBackendStatus('prognoseStatus', `✅ Cleanup abgeschlossen: ${result.deleted} Spiele gelöscht`, 'success');
            setTimeout(checkStatus, 2000);
        } else {
            updateBackendStatus('prognoseStatus', `❌ Fehler: ${result.error}`, 'error');
        }
    } catch (error) {
        updateBackendStatus('prognoseStatus', `❌ Verbindungsfehler: ${error.message}`, 'error');
    }
}

async function executePrognoseGenerate() {
    updateBackendStatus('prognoseStatus', '⏳ Prognose-Spiele werden generiert...', 'loading');
    
    try {
        const response = await fetch('/api/backend/prognose-generate', {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            updateBackendStatus('prognoseStatus', `✅ Generierung abgeschlossen: ${result.generated} Spiele`, 'success');
            setTimeout(checkStatus, 2000);
        } else {
            updateBackendStatus('prognoseStatus', `❌ Fehler: ${result.error}`, 'error');
        }
    } catch (error) {
        updateBackendStatus('prognoseStatus', `❌ Verbindungsfehler: ${error.message}`, 'error');
    }
}

async function executePrognoseSeasonDelete() {
    const season = document.getElementById('prognoseSeasonSelect').value;
    
    if (!confirm(`Prognose-Spiele für Season ${season} wirklich löschen?`)) {
        return;
    }
    
    updateBackendStatus('prognoseStatus', `⏳ Prognose-Spiele für Season ${season} werden gelöscht...`, 'loading');
    
    try {
        const response = await fetch(`/api/backend/prognose/season/${encodeURIComponent(season)}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            updateBackendStatus('prognoseStatus', `✅ Season ${season} gelöscht: ${result.deleted} Prognose-Spiele entfernt`, 'success');
            setTimeout(checkStatus, 2000);
        } else {
            updateBackendStatus('prognoseStatus', `❌ Fehler: ${result.error}`, 'error');
        }
    } catch (error) {
        updateBackendStatus('prognoseStatus', `❌ Verbindungsfehler: ${error.message}`, 'error');
    }
}

async function executeGameDetailsCrawling() {
    const season = document.getElementById('gameDetailsSeasonSelect').value;
    
    if (season === 'all') {
        updateBackendStatus('gameDetailsStatus', '⏳ Game Details für alle verfügbaren Seasons werden gecrawlt...', 'loading');
        
        try {
            // Erst verfügbare Seasons laden
            const seasonsResponse = await fetch('/api/game-details/seasons');
            const seasons = await seasonsResponse.json();
            
            if (!Array.isArray(seasons) || seasons.length === 0) {
                updateBackendStatus('gameDetailsStatus', '❌ Keine verfügbaren Seasons gefunden', 'error');
                return;
            }
            
            let totalSuccess = 0;
            let totalErrors = 0;
            
            // Jede Season einzeln crawlen
            for (const seasonToCrawl of seasons) {
                updateBackendStatus('gameDetailsStatus', `⏳ Crawle Details Season ${seasonToCrawl}... (${seasons.indexOf(seasonToCrawl) + 1}/${seasons.length})`, 'loading');
                
                const response = await fetch(`/api/crawl-game-details/${encodeURIComponent(seasonToCrawl)}`, {
                    method: 'POST'
                });
                
                const result = await response.json();
                
                if (result.success !== undefined) {
                    totalSuccess += result.success;
                    totalErrors += result.errors;
                }
                
                // Kurze Pause zwischen Seasons
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            updateBackendStatus('gameDetailsStatus', `✅ Alle Details Seasons gecrawlt: ${totalSuccess} Games, ${totalErrors} Fehler`, 'success');
            setTimeout(checkStatus, 2000);
            
        } catch (error) {
            updateBackendStatus('gameDetailsStatus', `❌ Fehler beim Crawlen aller Details Seasons: ${error.message}`, 'error');
        }
        
    } else {
        // Einzelne Season crawlen
        updateBackendStatus('gameDetailsStatus', `⏳ Game Details für Season ${season} werden gecrawlt...`, 'loading');
        
        try {
            const response = await fetch(`/api/crawl-game-details/${encodeURIComponent(season)}`, {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (result.success !== undefined) {
                updateBackendStatus('gameDetailsStatus', `✅ Details Season ${season} gecrawlt: ${result.success} Games, ${result.errors} Fehler`, 'success');
                setTimeout(checkStatus, 2000);
            } else {
                updateBackendStatus('gameDetailsStatus', `❌ Fehler: ${result.error}`, 'error');
            }
        } catch (error) {
            updateBackendStatus('gameDetailsStatus', `❌ Verbindungsfehler: ${error.message}`, 'error');
        }
    }
}

async function executeGameDetailsAllCrawling() {
    updateBackendStatus('gameDetailsStatus', '⏳ Legacy Game Details Crawling (alle Cup-Spiele)...', 'loading');
    
    try {
        const response = await fetch('/api/crawl-game-details', {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success !== undefined) {
            updateBackendStatus('gameDetailsStatus', `✅ Legacy Crawling abgeschlossen: ${result.success} erfolgreich, ${result.errors} Fehler`, 'success');
            setTimeout(checkStatus, 2000);
        } else {
            updateBackendStatus('gameDetailsStatus', `❌ Fehler: ${result.error}`, 'error');
        }
    } catch (error) {
        updateBackendStatus('gameDetailsStatus', `❌ Verbindungsfehler: ${error.message}`, 'error');
    }
}

async function executeGameDetailsDelete() {
    const season = document.getElementById('gameDetailsSeasonSelect').value;
    
    if (season === 'all') {
        updateBackendStatus('gameDetailsStatus', '❌ Löschung für "alle Seasons" nicht verfügbar', 'error');
        return;
    }
    
    if (!confirm(`Game Details für Season ${season} wirklich löschen?`)) {
        return;
    }
    
    updateBackendStatus('gameDetailsStatus', `⏳ Game Details für Season ${season} werden gelöscht...`, 'loading');
    
    try {
        const response = await fetch(`/api/game-details/season/${encodeURIComponent(season)}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.deleted !== undefined) {
            updateBackendStatus('gameDetailsStatus', `✅ Season ${season} gelöscht: ${result.deleted} Einträge entfernt`, 'success');
            setTimeout(checkStatus, 2000);
        } else {
            updateBackendStatus('gameDetailsStatus', `❌ Fehler: ${result.error}`, 'error');
        }
    } catch (error) {
        updateBackendStatus('gameDetailsStatus', `❌ Verbindungsfehler: ${error.message}`, 'error');
    }
}

async function executeGameEventsCrawling() {
    const season = document.getElementById('gameEventsSeasonSelect').value;
    
    if (season === 'all') {
        updateBackendStatus('gameEventsStatus', '⏳ Game Events für alle verfügbaren Seasons werden gecrawlt...', 'loading');
        
        try {
            // Erst verfügbare Seasons laden
            const seasonsResponse = await fetch('/api/game-events/seasons');
            const seasons = await seasonsResponse.json();
            
            if (!Array.isArray(seasons) || seasons.length === 0) {
                updateBackendStatus('gameEventsStatus', '❌ Keine verfügbaren Seasons gefunden', 'error');
                return;
            }
            
            let totalSuccess = 0;
            let totalErrors = 0;
            let totalEvents = 0;
            
            // Jede Season einzeln crawlen
            for (const seasonToCrawl of seasons) {
                updateBackendStatus('gameEventsStatus', `⏳ Crawle Events Season ${seasonToCrawl}... (${seasons.indexOf(seasonToCrawl) + 1}/${seasons.length})`, 'loading');
                
                const response = await fetch(`/api/crawl-game-events/${encodeURIComponent(seasonToCrawl)}`, {
                    method: 'POST'
                });
                
                const result = await response.json();
                
                if (result.success !== undefined) {
                    totalSuccess += result.success;
                    totalErrors += result.errors;
                    totalEvents += result.totalEvents || 0;
                }
                
                // Kurze Pause zwischen Seasons
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            updateBackendStatus('gameEventsStatus', `✅ Alle Events Seasons gecrawlt: ${totalSuccess} Games, ${totalEvents} Events, ${totalErrors} Fehler`, 'success');
            setTimeout(checkStatus, 2000);
            
        } catch (error) {
            updateBackendStatus('gameEventsStatus', `❌ Fehler beim Crawlen aller Events Seasons: ${error.message}`, 'error');
        }
        
    } else {
        // Einzelne Season crawlen
        updateBackendStatus('gameEventsStatus', `⏳ Game Events für Season ${season} werden gecrawlt...`, 'loading');
        
        try {
            const response = await fetch(`/api/crawl-game-events/${encodeURIComponent(season)}`, {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (result.success !== undefined) {
                updateBackendStatus('gameEventsStatus', `✅ Events Season ${season} gecrawlt: ${result.success} Games, ${result.totalEvents} Events, ${result.errors} Fehler`, 'success');
                setTimeout(checkStatus, 2000);
            } else {
                updateBackendStatus('gameEventsStatus', `❌ Fehler: ${result.error}`, 'error');
            }
        } catch (error) {
            updateBackendStatus('gameEventsStatus', `❌ Verbindungsfehler: ${error.message}`, 'error');
        }
    }
}

async function executeGameEventsAllCrawling() {
    updateBackendStatus('gameEventsStatus', '⏳ Legacy Game Events Crawling (alle Cup-Spiele)...', 'loading');
    
    try {
        const response = await fetch('/api/crawl-game-events', {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success !== undefined) {
            updateBackendStatus('gameEventsStatus', `✅ Legacy Crawling abgeschlossen: ${result.success} Games, ${result.totalEvents} Events, ${result.errors} Fehler`, 'success');
            setTimeout(checkStatus, 2000);
        } else {
            updateBackendStatus('gameEventsStatus', `❌ Fehler: ${result.error}`, 'error');
        }
    } catch (error) {
        updateBackendStatus('gameEventsStatus', `❌ Verbindungsfehler: ${error.message}`, 'error');
    }
}

async function executeGameEventsDelete() {
    const season = document.getElementById('gameEventsSeasonSelect').value;
    
    if (season === 'all') {
        updateBackendStatus('gameEventsStatus', '❌ Löschung für "alle Seasons" nicht verfügbar', 'error');
        return;
    }
    
    if (!confirm(`Game Events für Season ${season} wirklich löschen?`)) {
        return;
    }
    
    updateBackendStatus('gameEventsStatus', `⏳ Game Events für Season ${season} werden gelöscht...`, 'loading');
    
    try {
        const response = await fetch(`/api/game-events/season/${encodeURIComponent(season)}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.deleted !== undefined) {
            updateBackendStatus('gameEventsStatus', `✅ Season ${season} gelöscht: ${result.deleted} Einträge entfernt`, 'success');
            setTimeout(checkStatus, 2000);
        } else {
            updateBackendStatus('gameEventsStatus', `❌ Fehler: ${result.error}`, 'error');
        }
    } catch (error) {
        updateBackendStatus('gameEventsStatus', `❌ Verbindungsfehler: ${error.message}`, 'error');
    }
}

async function executeCompleteSeasonDelete() {
    const season = document.getElementById('completeDeleteSeasonSelect').value;
    
    if (!season) {
        updateBackendStatus('completeDeleteStatus', '❌ Bitte eine Season auswählen', 'error');
        return;
    }
    
    if (!confirm(`ACHTUNG: Season ${season} KOMPLETT löschen?\n\nDies löscht ALLE Daten dieser Season unwiderruflich:\n- Cup-Spiele\n- Prognose-Spiele\n- Game Details\n- Game Events\n\nDieser Vorgang kann nicht rückgängig gemacht werden!`)) {
        return;
    }
    
    if (!confirm(`Sind Sie sich ABSOLUT sicher?\n\nSeason ${season} wird VOLLSTÄNDIG gelöscht!`)) {
        return;
    }
    
    updateBackendStatus('completeDeleteStatus', `⏳ Season ${season} wird KOMPLETT gelöscht...`, 'loading');
    
    try {
        const response = await fetch(`/api/backend/complete-season/${encodeURIComponent(season)}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            updateBackendStatus('completeDeleteStatus', `✅ Season ${season} komplett gelöscht: ${result.totalDeleted} Einträge entfernt`, 'success');
            setTimeout(checkStatus, 2000);
            // Reset Select
            document.getElementById('completeDeleteSeasonSelect').value = '';
        } else {
            updateBackendStatus('completeDeleteStatus', `❌ Fehler: ${result.error}`, 'error');
        }
    } catch (error) {
        updateBackendStatus('completeDeleteStatus', `❌ Verbindungsfehler: ${error.message}`, 'error');
    }
}