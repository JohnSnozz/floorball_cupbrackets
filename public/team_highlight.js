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

// Modifikation für team_highlight.js - BEHÄLT die ursprüngliche Schriftgröße

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
            // WICHTIG: Speichere die AKTUELLE Schriftgröße BEVOR das Highlighting
            const currentStyle = getComputedStyle(teamNameElement);
            const originalFontSize = currentStyle.fontSize;
            const originalFontWeight = currentStyle.fontWeight;
            const originalLineHeight = currentStyle.lineHeight;
            
            const teamScoreEl = teamElement.querySelector('.team-score');
            let originalScoreFontSize = '15px';
            let originalScoreFontWeight = '600';
            
            if (teamScoreEl) {
                const scoreStyle = getComputedStyle(teamScoreEl);
                originalScoreFontSize = scoreStyle.fontSize;
                originalScoreFontWeight = scoreStyle.fontWeight;
            }
            
            // CSS-Klasse hinzufügen
            teamElement.classList.add('highlight');
            
            // Force die ORIGINALE Schrift per Inline-Styles (behält responsive Größen)
            if (teamNameElement) {
                teamNameElement.style.setProperty('font-size', originalFontSize, 'important');
                teamNameElement.style.setProperty('font-weight', originalFontWeight, 'important');
                teamNameElement.style.setProperty('line-height', originalLineHeight, 'important');
                teamNameElement.style.setProperty('color', '#ffffff', 'important');
                teamNameElement.style.setProperty('transform', 'none', 'important');
                
                // Speichere die Original-Werte für später
                teamNameElement.setAttribute('data-original-font-size', originalFontSize);
                teamNameElement.setAttribute('data-original-font-weight', originalFontWeight);
            }
            
            if (teamScoreEl) {
                teamScoreEl.style.setProperty('font-size', originalScoreFontSize, 'important');
                teamScoreEl.style.setProperty('font-weight', originalScoreFontWeight, 'important');
                teamScoreEl.style.setProperty('color', '#ffffff', 'important');
                
                // Winner-spezifische Farbanpassungen
                if (teamElement.classList.contains('winner')) {
                    teamScoreEl.style.setProperty('color', '#ffffff', 'important');
                }
            }
            
            highlightCount++;
            console.log(`   -> Highlighted team instance ${highlightCount}: ${elementText} (font-size: ${originalFontSize})`);
        }
    });
    
    console.log(`✅ Total highlighted instances: ${highlightCount}`);
}

function removeHighlight() {
    // Entferne alle highlight Klassen UND Inline-Styles
    const highlightedTeams = document.querySelectorAll('.team.highlight');
    highlightedTeams.forEach(team => {
        team.classList.remove('highlight');
        
        // Entferne die geforcten Inline-Styles
        const teamNameEl = team.querySelector('.team-name');
        const teamScoreEl = team.querySelector('.team-score');
        
        if (teamNameEl) {
            teamNameEl.style.removeProperty('font-size');
            teamNameEl.style.removeProperty('font-weight');
            teamNameEl.style.removeProperty('line-height');
            teamNameEl.style.removeProperty('color');
            teamNameEl.style.removeProperty('transform');
            
            // Entferne auch die gespeicherten Attribute
            teamNameEl.removeAttribute('data-original-font-size');
            teamNameEl.removeAttribute('data-original-font-weight');
        }
        
        if (teamScoreEl) {
            teamScoreEl.style.removeProperty('font-size');
            teamScoreEl.style.removeProperty('font-weight');
            teamScoreEl.style.removeProperty('color');
        }
    });
}

// ZUSATZ: Debugging-Funktion um zu sehen welche Schriftgrößen gesetzt sind
function debugTeamFontSizes() {
    console.log('🔍 Aktuelle Team-Schriftgrößen:');
    document.querySelectorAll('.team-name').forEach((el, index) => {
        const style = getComputedStyle(el);
        const text = el.textContent.trim();
        console.log(`Team ${index + 1}: "${text}" → ${style.fontSize} (${el.className})`);
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