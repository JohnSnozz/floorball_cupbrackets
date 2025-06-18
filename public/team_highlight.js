// Team Highlighting für Swiss Cup Brackets

// Team Highlighting für Swiss Cup Brackets

function initializeTeamHighlighting() {
    console.log('🎯 Initializing team highlighting...');
    
    // Entferne alle existierenden Event Listener
    removeTeamHighlighting();
    
    // Finde alle Team-Elemente (nicht nur Namen)
    const teams = document.querySelectorAll('.team');
    
    teams.forEach(teamElement => {
        const teamNameElement = teamElement.querySelector('.team-name');
        if (!teamNameElement) return;
        
        const teamText = teamNameElement.textContent.trim();
        
        // Ignoriere leere Namen, TBD und Freilos
        if (!teamText || teamText === 'TBD' || teamText === 'Freilos') {
            return;
        }
        
        // Hover Events auf das gesamte Team-Element hinzufügen
        teamElement.addEventListener('mouseenter', function() {
            highlightAllTeams(teamText);
        });
        
        teamElement.addEventListener('mouseleave', function() {
            removeHighlight();
        });
    });
    
    console.log(`✅ Team highlighting initialized for ${teams.length} team elements`);
}

function highlightAllTeams(teamName) {
    console.log(`🔍 Highlighting all instances of team: ${teamName}`);
    
    // Entferne erst alle vorhandenen Highlights
    removeHighlight();
    
    // Finde ALLE Teams mit diesem Namen im gesamten Bracket
    const allTeams = document.querySelectorAll('.team');
    let highlightCount = 0;
    
    allTeams.forEach(teamElement => {
        const teamNameElement = teamElement.querySelector('.team-name');
        if (!teamNameElement) return;
        
        const elementText = teamNameElement.textContent.trim();
        
        if (elementText === teamName) {
            teamElement.classList.add('highlight');
            highlightCount++;
            console.log(`   -> Highlighted team instance ${highlightCount}: ${elementText}`);
        }
    });
    
    console.log(`✅ Total highlighted instances: ${highlightCount}`);
}

function removeHighlight() {
    // Entferne alle highlight Klassen
    const highlightedTeams = document.querySelectorAll('.team.highlight');
    highlightedTeams.forEach(team => {
        team.classList.remove('highlight');
    });
}

function removeTeamHighlighting() {
    // Entferne alle Event Listener durch Klonen der Elemente
    const teams = document.querySelectorAll('.team');
    teams.forEach(element => {
        const clone = element.cloneNode(true);
        element.parentNode.replaceChild(clone, element);
    });
    
    // Entferne alle aktiven Highlights
    removeHighlight();
}

// Auto-Initialisierung nach Bracket-Rendering
document.addEventListener('DOMContentLoaded', function() {
    // Observer für Bracket-Änderungen
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && 
                mutation.target.classList && 
                mutation.target.classList.contains('bracket')) {
                setTimeout(initializeTeamHighlighting, 300);
            }
        });
    });
    
    // Beobachte Bracket-Container
    const bracketContainer = document.querySelector('.bracket-container');
    if (bracketContainer) {
        observer.observe(bracketContainer, { childList: true, subtree: true });
    }
});

// Exportiere Funktion für manuellen Aufruf
window.initializeTeamHighlighting = initializeTeamHighlighting;