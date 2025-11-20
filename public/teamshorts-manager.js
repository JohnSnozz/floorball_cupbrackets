// Teamshorts Manager JavaScript

let teamshortsData = [];
let modifiedTeams = new Set();

// Logout-Funktion
function logout() {
    if (confirm('Möchten Sie sich wirklich abmelden?')) {
        window.location.href = '/api/auth/logout';
    }
}

// Lade alle Teamshorts von der API
async function loadTeamshorts() {
    try {
        showStatus('Lade Teamshorts...', 'info');

        const response = await fetch('/api/teamshorts', {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        teamshortsData = data.teamshorts || [];
        modifiedTeams.clear();

        renderTable();
        updateTeamCount();
        showStatus(`✅ ${teamshortsData.length} Teams geladen`, 'success');

        // Status nach 3 Sekunden ausblenden
        setTimeout(() => hideStatus(), 3000);
    } catch (error) {
        console.error('Fehler beim Laden:', error);
        showStatus(`❌ Fehler beim Laden: ${error.message}`, 'error');
    }
}

// Rendere die Tabelle
function renderTable() {
    const tbody = document.getElementById('teamshortsTableBody');

    if (!teamshortsData || teamshortsData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="loading-row">
                    <div class="loading-spinner">Keine Teams gefunden</div>
                </td>
            </tr>
        `;
        return;
    }

    // Sortiere alphabetisch nach Team-Namen
    const sortedData = [...teamshortsData].sort((a, b) =>
        a.team.localeCompare(b.team)
    );

    tbody.innerHTML = sortedData.map(item => `
        <tr data-team="${escapeHtml(item.team)}">
            <td>
                <div class="static-field">${escapeHtml(item.team)}</div>
            </td>
            <td>
                <input
                    type="text"
                    class="editable-field"
                    value="${escapeHtml(item.teamshort || '')}"
                    data-team="${escapeHtml(item.team)}"
                    data-original="${escapeHtml(item.teamshort || '')}"
                    onchange="markAsModified(this)"
                    placeholder="Abkürzung eingeben..."
                >
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-danger btn-small" onclick="deleteTeam('${escapeHtml(item.team)}')">
                        🗑️ Löschen
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Markiere Feld als geändert
function markAsModified(input) {
    const originalValue = input.dataset.original;
    const currentValue = input.value;
    const team = input.dataset.team;

    if (currentValue !== originalValue) {
        input.classList.add('modified');
        modifiedTeams.add(team);
    } else {
        input.classList.remove('modified');
        modifiedTeams.delete(team);
    }

    // Update Button-Text
    updateSaveButtonText();
}

// Update Save Button Text
function updateSaveButtonText() {
    const saveBtn = document.querySelector('button[onclick="saveAllChanges()"]');
    if (saveBtn) {
        if (modifiedTeams.size > 0) {
            saveBtn.textContent = `💾 Speichern (${modifiedTeams.size} Änderung${modifiedTeams.size > 1 ? 'en' : ''})`;
        } else {
            saveBtn.textContent = '💾 Alle Änderungen speichern';
        }
    }
}

// Speichere alle Änderungen
async function saveAllChanges() {
    if (modifiedTeams.size === 0) {
        showStatus('ℹ️ Keine Änderungen zum Speichern', 'info');
        setTimeout(() => hideStatus(), 3000);
        return;
    }

    try {
        showStatus(`Speichere ${modifiedTeams.size} Änderung(en)...`, 'info');

        const updates = [];
        const inputs = document.querySelectorAll('.editable-field.modified');

        inputs.forEach(input => {
            updates.push({
                team: input.dataset.team,
                teamshort: input.value.trim()
            });
        });

        const response = await fetch('/api/teamshorts/update-multiple', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ updates })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
            showStatus(`✅ ${updates.length} Änderung(en) erfolgreich gespeichert`, 'success');

            // Update original values und entferne modified class
            inputs.forEach(input => {
                input.dataset.original = input.value;
                input.classList.remove('modified');
            });

            modifiedTeams.clear();
            updateSaveButtonText();

            // Lade neu um sicherzustellen dass alles synchron ist
            setTimeout(() => loadTeamshorts(), 1500);
        } else {
            throw new Error(result.error || 'Unbekannter Fehler');
        }
    } catch (error) {
        console.error('Fehler beim Speichern:', error);
        showStatus(`❌ Fehler beim Speichern: ${error.message}`, 'error');
    }
}

// Lösche ein Team
async function deleteTeam(teamName) {
    if (!confirm(`Möchten Sie "${teamName}" wirklich löschen?`)) {
        return;
    }

    try {
        showStatus(`Lösche "${teamName}"...`, 'info');

        const response = await fetch(`/api/teamshorts/${encodeURIComponent(teamName)}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
            showStatus(`✅ "${teamName}" erfolgreich gelöscht`, 'success');

            // Entferne aus modifiedTeams falls vorhanden
            modifiedTeams.delete(teamName);
            updateSaveButtonText();

            // Lade neu
            setTimeout(() => loadTeamshorts(), 1000);
        } else {
            throw new Error(result.error || 'Fehler beim Löschen');
        }
    } catch (error) {
        console.error('Fehler beim Löschen:', error);
        showStatus(`❌ Fehler beim Löschen: ${error.message}`, 'error');
    }
}

// Füge neues Team hinzu
async function addNewTeam() {
    const teamName = prompt('Geben Sie den Team-Namen ein:');
    if (!teamName || teamName.trim() === '') {
        return;
    }

    const teamShort = prompt(`Geben Sie die Abkürzung für "${teamName}" ein:`);
    if (teamShort === null) {
        return;
    }

    try {
        showStatus(`Füge "${teamName}" hinzu...`, 'info');

        const response = await fetch('/api/teamshorts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                team: teamName.trim(),
                teamshort: teamShort.trim()
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
            showStatus(`✅ "${teamName}" erfolgreich hinzugefügt`, 'success');
            setTimeout(() => loadTeamshorts(), 1000);
        } else {
            throw new Error(result.error || 'Fehler beim Hinzufügen');
        }
    } catch (error) {
        console.error('Fehler beim Hinzufügen:', error);
        showStatus(`❌ Fehler beim Hinzufügen: ${error.message}`, 'error');
    }
}

// Filtere Teams nach Suchbegriff
function filterTeams() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput.value.toLowerCase().trim();
    const rows = document.querySelectorAll('#teamshortsTableBody tr');

    rows.forEach(row => {
        const teamName = row.dataset.team || '';
        const teamShort = row.querySelector('.editable-field')?.value || '';

        const matchesSearch =
            teamName.toLowerCase().includes(searchTerm) ||
            teamShort.toLowerCase().includes(searchTerm);

        if (matchesSearch || searchTerm === '') {
            row.classList.remove('hidden');
        } else {
            row.classList.add('hidden');
        }
    });
}

// Lösche Suchfilter
function clearSearch() {
    document.getElementById('searchInput').value = '';
    filterTeams();
}

// Update Team Count
function updateTeamCount() {
    const totalTeams = document.getElementById('totalTeams');
    totalTeams.textContent = teamshortsData.length;
}

// Zeige Status-Nachricht
function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${type}`;
}

// Verstecke Status-Nachricht
function hideStatus() {
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.style.display = 'none';
}

// HTML escapen für XSS-Schutz
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + S zum Speichern
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveAllChanges();
    }

    // Escape um Suche zu löschen
    if (e.key === 'Escape') {
        clearSearch();
    }
});
