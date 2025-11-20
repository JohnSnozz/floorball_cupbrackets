// Round Headers für Swiss Cup Brackets
// Zeigt Rundenbezeichnungen über jeder Spalte an

class RoundHeaders {
    constructor() {
        this.headers = [];
        this.bracketContainer = null;
        this.isInitialized = false;
    }
    
    // Initialisiert die Round Headers
    initialize(smartRounds) {
        console.log('📋 Initializing Round Headers...');
        
        if (!smartRounds || smartRounds.length === 0) {
            console.log('⏭️ No rounds provided for headers');
            return;
        }
        
        this.bracketContainer = document.querySelector('.smart-bracket');
        if (!this.bracketContainer) {
            console.error('❌ Smart bracket container not found');
            return;
        }
        
        // Entferne alle bestehenden Headers
        this.clearHeaders();
        
        // Erstelle neue Headers
        this.createHeaders(smartRounds);
        
        this.isInitialized = true;
        console.log(`✅ Round Headers initialized with ${this.headers.length} headers`);
    }
    
    // Entfernt alle bestehenden Headers
    clearHeaders() {
        const existingHeaders = this.bracketContainer.querySelectorAll('.round-header');
        existingHeaders.forEach(header => header.remove());
        this.headers = [];
        console.log('🧹 Cleared existing round headers');
    }
    
    // Erstellt Header für alle Runden
    createHeaders(smartRounds) {
        console.log('📋 Creating round headers...');
        
        smartRounds.forEach((round, index) => {
            this.createSingleHeader(round, index);
        });
    }
    
    // Erstellt einen einzelnen Header
    createSingleHeader(round, index) {
        const headerElement = document.createElement('div');
        headerElement.className = 'round-header';

        // Position über der Runde mit Padding-Offset
        const roundX = (round.roundX || (index * 300)) + 30; // +30px für linkes Padding
        const headerY = 30; // 30px Padding vom oberen Rand des Brackets
        
        // Styling
        headerElement.style.cssText = `
            position: absolute;
            left: ${roundX}px;
            top: ${headerY}px;
            width: 240px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: rgba(255, 255, 255, 0.7);
            font-size: 13px;
            font-weight: 500;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif;
            pointer-events: none;
            z-index: 2;
            text-align: center;
        `;
        
        // Rundenname formatieren
        const formattedName = this.formatRoundName(round.name);
        headerElement.textContent = formattedName;
        
        // Zu Bracket hinzufügen
        this.bracketContainer.appendChild(headerElement);
        this.headers.push(headerElement);
        
        console.log(`📝 Created header for round: ${round.name} → ${formattedName} at x=${roundX}`);
    }
    
    // Formatiert Rundennamen für bessere Lesbarkeit
    formatRoundName(roundName) {
        if (!roundName) return 'Unbekannt';
        
        // 1/X Format beibehalten aber lesbarer machen
        const match = roundName.match(/^1\/(\d+)$/);
        if (match) {
            const number = parseInt(match[1]);
            
            // Spezielle Namen für bekannte Runden
            switch (number) {
                case 128: return '1/128-Finale';
                case 64: return '1/64-Finale';
                case 32: return '1/32-Finale';
                case 16: return '1/16-Finale';
                case 8: return 'Achtelfinal';
                case 4: return 'Viertelfinal';
                case 2: return 'Halbfinal';
                case 1: return 'Final';
                default: return `1/${number}-Finale`;
            }
        }
        
        // Fallback: Originalname
        return roundName;
    }
    
    // Update Headers Position (z.B. nach Zoom)
    updateHeadersPosition() {
        if (!this.isInitialized || this.headers.length === 0) return;
        
        // Headers sind absolut positioniert und bewegen sich automatisch mit dem Bracket
        // Keine zusätzliche Aktualisierung nötig
        console.log('📋 Headers position updated automatically');
    }
    
    // Cleanup
    destroy() {
        this.clearHeaders();
        this.bracketContainer = null;
        this.isInitialized = false;
        console.log('🗑️ Round Headers destroyed');
    }
    
    // Debug-Funktion
    debugHeaders() {
        console.log('🔍 Round Headers Debug:');
        console.log(`Initialized: ${this.isInitialized}`);
        console.log(`Headers count: ${this.headers.length}`);
        
        this.headers.forEach((header, index) => {
            const style = getComputedStyle(header);
            console.log(`Header ${index + 1}:`, {
                text: header.textContent,
                left: style.left,
                top: style.top,
                visible: style.display !== 'none' && style.opacity !== '0'
            });
        });
    }
}

// Global Instance
let roundHeadersInstance = null;

// Haupt-Initialisierungsfunktion
function initializeRoundHeaders(smartRounds) {
    console.log('📋 Initializing Round Headers with rounds:', smartRounds?.length || 0);
    
    if (!smartRounds || smartRounds.length === 0) {
        console.log('⏭️ No rounds provided for headers');
        return;
    }
    
    // Erstelle oder verwende bestehende Instanz
    if (!roundHeadersInstance) {
        roundHeadersInstance = new RoundHeaders();
    }
    
    // Warte kurz damit das Bracket vollständig gerendert ist
    setTimeout(() => {
        roundHeadersInstance.initialize(smartRounds);
    }, 100);
}

// Reset-Funktion für neues Bracket
function resetRoundHeaders() {
    if (roundHeadersInstance) {
        roundHeadersInstance.destroy();
        roundHeadersInstance = null;
    }
    console.log('🔄 Round Headers reset');
}

// Integration über DOM Observer - SICHERER ANSATZ ohne Hook-Interferenzen
document.addEventListener('DOMContentLoaded', function() {
    // Observer für Bracket-Änderungen
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                // Prüfe ob Smart Bracket hinzugefügt wurde
                const addedNodes = Array.from(mutation.addedNodes);
                const hasSmartBracket = addedNodes.some(node => 
                    node.nodeType === Node.ELEMENT_NODE && 
                    (node.classList.contains('smart-bracket') || 
                     node.querySelector('.smart-bracket'))
                );
                
                if (hasSmartBracket) {
                    console.log('📋 Smart Bracket detected, creating headers...');
                    
                    // Warte auf vollständiges Rendering und erstelle Headers
                    setTimeout(() => {
                        createHeadersFromProcessedRounds();
                    }, 300);
                }
            }
        });
    });
    
    // Überwache Bracket Container
    const bracketContainer = document.querySelector('.bracket-container') || document.body;
    observer.observe(bracketContainer, { 
        childList: true, 
        subtree: true 
    });
    
    console.log('👁️ Round Headers observer initialized (safe mode)');
});

// Erstelle Headers aus verarbeiteten Round-Daten
function createHeadersFromProcessedRounds() {
    // Versuche zuerst die verarbeiteten SmartRounds zu verwenden
    if (window.lastProcessedSmartRounds && window.lastProcessedSmartRounds.length > 0) {
        console.log('📋 Creating headers from processed smart rounds...');
        // Konvertiere zu richtigem Format
        const smartRounds = window.lastProcessedSmartRounds.map((round, index) => ({
            name: round.name, // Echter Rundenname aus smartbracket.js
            roundX: round.roundX || (index * 300),
            games: round.games || []
        }));
        initializeRoundHeaders(smartRounds);
        return;
    }
    
    // Fallback: Verwende currentRounds mit echten Namen
    if (window.currentRounds && window.currentRounds.length > 0) {
        console.log('📋 Creating headers from currentRounds...');
        
        const smartRounds = window.currentRounds.map((round, index) => ({
            name: round[0] || round.name || `Runde ${index + 1}`, // Echter Rundenname aus currentRounds
            roundX: index * 300, // Standard-Abstand, wird später korrigiert
            games: round[1] || round.games || []
        }));
        
        // Korrigiere roundX aus DOM
        setTimeout(() => {
            correctRoundXPositions(smartRounds);
            initializeRoundHeaders(smartRounds);
        }, 100);
        return;
    }
    
    // Letzter Fallback: DOM-basierte Erstellung
    tryCreateHeadersFromDOM();
}

// Korrigiere X-Positionen aus dem gerenderten DOM
function correctRoundXPositions(smartRounds) {
    const smartBracket = document.querySelector('.smart-bracket');
    if (!smartBracket) return;
    
    const matches = smartBracket.querySelectorAll('.smart-match-absolute');
    if (matches.length === 0) return;
    
    // Gruppiere Matches nach X-Position
    const roundPositions = new Map();
    
    matches.forEach(match => {
        const style = getComputedStyle(match);
        const left = parseInt(style.left) || 0;
        
        if (!roundPositions.has(left)) {
            roundPositions.set(left, []);
        }
        roundPositions.get(left).push(match);
    });
    
    // Sortiere Positionen
    const sortedPositions = Array.from(roundPositions.keys()).sort((a, b) => a - b);
    
    // Update roundX Werte
    smartRounds.forEach((round, index) => {
        if (sortedPositions[index] !== undefined) {
            round.roundX = sortedPositions[index];
        }
    });
    
    console.log('📋 Corrected round X positions:', smartRounds.map(r => `${r.name}: ${r.roundX}px`));
}

// Fallback: Versuche Headers aus DOM-Struktur zu erstellen
function tryCreateHeadersFromDOM() {
    const smartBracket = document.querySelector('.smart-bracket');
    if (!smartBracket) return;
    
    const matches = smartBracket.querySelectorAll('.smart-match-absolute');
    if (matches.length === 0) return;
    
    console.log('📋 Creating headers from DOM structure...');
    
    // Gruppiere Matches nach X-Position (Runden)
    const roundsMap = new Map();
    
    matches.forEach(match => {
        const style = getComputedStyle(match);
        const left = parseInt(style.left) || 0;
        
        if (!roundsMap.has(left)) {
            roundsMap.set(left, []);
        }
        roundsMap.get(left).push(match);
    });
    
    // Sortiere Runden nach X-Position
    const sortedRounds = Array.from(roundsMap.entries()).sort((a, b) => a[0] - b[0]);
    
    // Erstelle smartRounds Format
    const smartRounds = sortedRounds.map((entry, index) => {
        const [roundX, roundMatches] = entry;
        
        // Versuche Rundenname aus erstem Match zu extrahieren
        const firstMatch = roundMatches[0];
        const sortOrder = firstMatch?.getAttribute('data-bracket-sort');
        
        // Schätze Rundenname basierend auf Position und Match-Anzahl
        let roundName = `Runde ${index + 1}`;
        
        // Bessere Schätzung basierend auf Anzahl Matches
        const matchCount = roundMatches.length;
        if (matchCount <= 1) {
            roundName = 'Final';
        } else if (matchCount <= 2) {
            roundName = 'Halbfinal';
        } else if (matchCount <= 4) {
            roundName = 'Viertelfinal';
        } else if (matchCount <= 8) {
            roundName = 'Achtelfinal';
        } else if (matchCount <= 16) {
            roundName = '1/16-Finale';
        } else if (matchCount <= 32) {
            roundName = '1/32-Finale';
        } else if (matchCount <= 64) {
            roundName = '1/64-Finale';
        }
        
        return {
            name: roundName,
            roundX: roundX,
            games: roundMatches
        };
    });
    
    console.log(`📋 Created ${smartRounds.length} rounds from DOM:`, smartRounds.map(r => r.name));
    
    initializeRoundHeaders(smartRounds);
}

// Debug-Funktionen
window.debugRoundHeaders = function() {
    if (roundHeadersInstance) {
        roundHeadersInstance.debugHeaders();
    } else {
        console.log('❌ No Round Headers instance available');
    }
};

window.refreshRoundHeaders = function() {
    tryCreateHeadersFromDOM();
};

// Export Functions
window.initializeRoundHeaders = initializeRoundHeaders;
window.resetRoundHeaders = resetRoundHeaders;
window.RoundHeaders = RoundHeaders;