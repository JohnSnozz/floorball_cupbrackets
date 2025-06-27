// Smart Connectors für Swiss Cup Brackets - FIXED VERSION
// Zeichnet Verbindungslinien zwischen Games in absolut positionierten Brackets

class SmartConnector {
    constructor() {
        this.connectors = [];
        this.rounds = [];
        this.bracketContainer = null;
    }
    
    // Initialisiert die Smart Connectors mit Rundendaten
    initialize(smartRounds) {
        console.log('🔗 Initializing Smart Connectors...');
        
        this.rounds = smartRounds || [];
        this.bracketContainer = document.querySelector('.smart-bracket');
        
        if (!this.bracketContainer) {
            console.error('❌ Smart bracket container not found');
            return;
        }
        
        // Entferne alle bestehenden Connector
        this.clearConnectors();
        
        // Erstelle neue Connector
        this.createConnectors();
        
        console.log(`✅ Smart Connectors initialized with ${this.connectors.length} connectors`);
    }
    
    // Entfernt alle bestehenden Connector
    clearConnectors() {
        const existingConnectors = this.bracketContainer.querySelectorAll('.smart-connector');
        existingConnectors.forEach(connector => connector.remove());
        this.connectors = [];
        console.log('🧹 Cleared existing connectors');
    }
    
    // Erstellt alle Verbindungslinien
    createConnectors() {
        if (this.rounds.length < 2) {
            console.log('⏭️ Not enough rounds for connectors');
            return;
        }
        
        // Iteriere durch aufeinanderfolgende Runden
        for (let i = 0; i < this.rounds.length - 1; i++) {
            const sourceRound = this.rounds[i];
            const targetRound = this.rounds[i + 1];
            
            this.connectRounds(sourceRound, targetRound);
        }
    }
    
    // Verbindet zwei aufeinanderfolgende Runden
    connectRounds(sourceRound, targetRound) {
        console.log(`🔗 Connecting ${sourceRound.name} -> ${targetRound.name}`);
        
        // Für jedes Spiel in der Zielrunde finde die Vorgängerspiele
        targetRound.gamePositions.forEach(targetPos => {
            const targetGame = targetPos.game;
            const targetSortOrder = parseInt(targetGame.bracketsortorder);
            
            // Berechne erwartete Vorgänger-SortOrders
            const pred1SortOrder = (targetSortOrder * 2) - 1;
            const pred2SortOrder = targetSortOrder * 2;
            
            // Finde Vorgängerspiele
            const pred1 = sourceRound.gamePositions.find(pos => 
                parseInt(pos.game.bracketsortorder) === pred1SortOrder
            );
            const pred2 = sourceRound.gamePositions.find(pos => 
                parseInt(pos.game.bracketsortorder) === pred2SortOrder
            );
            
            // Erstelle Verbindungen
            if (pred1) {
                this.createConnection(pred1, targetPos, 'game1');
            }
            if (pred2) {
                this.createConnection(pred2, targetPos, 'game2');
            }
        });
    }
    
    // KRITISCHER FIX: Erstellt eine einzelne Verbindungslinie
    createConnection(sourcePos, targetPos, connectionType) {
        const sourceGame = sourcePos.game;
        const targetGame = targetPos.game;
        
        // Berechne Verbindungspunkte - KORRIGIERTE BERECHNUNG
        const sourceRight = sourcePos.x + sourcePos.width;
        const sourceCenterY = sourcePos.y + (sourcePos.height / 2);
        
        const targetLeft = targetPos.x;
        const targetCenterY = targetPos.y + (targetPos.height / 2);
        
        // KRITISCHER FIX: Korrekte Berechnung der Verbindungsgeometrie
        const bridgeX = sourceRight + 20; // 20px Abstand vom Source-Match
        
        // 1. Horizontale Linie vom Source-Match zur Bridge
        this.createHorizontalLine(sourceRight, sourceCenterY, bridgeX, sourceGame, targetGame, 'out');
        
        // 2. Vertikale Verbindung (falls Y-Koordinaten unterschiedlich)
        if (Math.abs(sourceCenterY - targetCenterY) > 1) {
            this.createVerticalLine(bridgeX, sourceCenterY, targetCenterY, sourceGame, targetGame);
        }
        
        // 3. Horizontale Linie von der Bridge zum Target-Match
        this.createHorizontalLine(bridgeX, targetCenterY, targetLeft, sourceGame, targetGame, 'in');
    }
    
    // KRITISCHER FIX: Erstellt eine horizontale Linie mit korrekter Positionierung
    createHorizontalLine(startX, y, endX, sourceGame, targetGame, type) {
        const width = Math.abs(endX - startX);
        const left = Math.min(startX, endX);
        
        if (width < 1) {
            console.log(`⚠️ Skipping horizontal line: width too small (${width})`);
            return;
        }
        
        const connector = document.createElement('div');
        connector.className = `smart-connector horizontal ${type}-line`;
        connector.style.cssText = `
            position: absolute;
            left: ${left}px;
            top: ${y - 1}px;
            width: ${width}px;
            height: 2px;
            background-color: #666;
            z-index: 0;
            pointer-events: none;
            opacity: 0.8;
        `;
        
        // Debug-Attribute
        connector.setAttribute('data-source-game', sourceGame.bracketsortorder);
        connector.setAttribute('data-target-game', targetGame.bracketsortorder);
        connector.setAttribute('data-connector-type', `horizontal-${type}`);
        
        this.bracketContainer.appendChild(connector);
        this.connectors.push(connector);
        
        console.log(`➡️ Created horizontal ${type} line: ${left}px,${y}px (${width}px wide)`);
    }
    
    // KRITISCHER FIX: Erstellt eine vertikale Linie mit korrekter Positionierung
    createVerticalLine(x, startY, endY, sourceGame, targetGame) {
        const height = Math.abs(endY - startY);
        const top = Math.min(startY, endY);
        
        if (height < 1) {
            console.log(`⚠️ Skipping vertical line: height too small (${height})`);
            return;
        }
        
        const connector = document.createElement('div');
        connector.className = 'smart-connector vertical vertical-bridge';
        connector.style.cssText = `
            position: absolute;
            left: ${x - 1}px;
            top: ${top}px;
            width: 2px;
            height: ${height}px;
            background-color: #666;
            z-index: 0;
            pointer-events: none;
            opacity: 0.8;
        `;
        
        // Debug-Attribute
        connector.setAttribute('data-source-game', sourceGame.bracketsortorder);
        connector.setAttribute('data-target-game', targetGame.bracketsortorder);
        connector.setAttribute('data-connector-type', 'vertical-bridge');
        
        this.bracketContainer.appendChild(connector);
        this.connectors.push(connector);
        
        console.log(`⬇️ Created vertical bridge: ${x}px,${top}px (${height}px tall)`);
    }
    
    // Highlight-Pfad für bestimmtes Team
    highlightTeamPath(teamName) {
        // Entferne alle bestehenden Highlights
        this.removeHighlights();
        
        // Finde alle Spiele mit diesem Team
        const teamGames = [];
        this.rounds.forEach(round => {
            round.gamePositions.forEach(pos => {
                const game = pos.game;
                if (game.team1 === teamName || game.team2 === teamName) {
                    teamGames.push({
                        game: game,
                        position: pos,
                        round: round
                    });
                }
            });
        });
        
        // Highlight Connectors zwischen Team-Spielen
        teamGames.forEach(teamGame => {
            this.connectors.forEach(connector => {
                const sourceSort = connector.getAttribute('data-source-game');
                const targetSort = connector.getAttribute('data-target-game');
                
                if (sourceSort === teamGame.game.bracketsortorder || 
                    targetSort === teamGame.game.bracketsortorder) {
                    connector.classList.add('highlight-path');
                }
            });
        });
    }
    
    // Entfernt alle Highlights
    removeHighlights() {
        this.connectors.forEach(connector => {
            connector.classList.remove('highlight-path');
        });
    }
    
    // Debug-Funktion: Zeigt alle Connector-Informationen
    debugConnectors() {
        console.log('🔍 Smart Connectors Debug:');
        console.log(`Total connectors: ${this.connectors.length}`);
        
        this.connectors.forEach((connector, index) => {
            const rect = connector.getBoundingClientRect();
            console.log(`Connector ${index + 1}:`, {
                type: connector.getAttribute('data-connector-type'),
                source: connector.getAttribute('data-source-game'),
                target: connector.getAttribute('data-target-game'),
                position: { x: connector.style.left, y: connector.style.top },
                size: { width: connector.style.width, height: connector.style.height },
                visible: rect.width > 0 && rect.height > 0,
                computedStyle: {
                    display: window.getComputedStyle(connector).display,
                    opacity: window.getComputedStyle(connector).opacity,
                    zIndex: window.getComputedStyle(connector).zIndex
                }
            });
        });
        
        // Zusätzlich: Zeige Bracket-Dimensionen
        if (this.bracketContainer) {
            const bracketRect = this.bracketContainer.getBoundingClientRect();
            console.log('Bracket Container:', {
                width: bracketRect.width,
                height: bracketRect.height,
                position: this.bracketContainer.style.position,
                overflow: window.getComputedStyle(this.bracketContainer).overflow
            });
        }
    }
    
    // Passt Connector-Farben basierend auf Status an
    updateConnectorStyles() {
        this.connectors.forEach(connector => {
            // Standard-Styling anwenden
            const sourceSort = connector.getAttribute('data-source-game');
            const targetSort = connector.getAttribute('data-target-game');
            
            // Prüfe ob Spiele Freilos enthalten
            let isFreilosConnection = false;
            this.rounds.forEach(round => {
                round.gamePositions.forEach(pos => {
                    if (pos.game.bracketsortorder === sourceSort || 
                        pos.game.bracketsortorder === targetSort) {
                        if (this.isFreilosGame(pos.game)) {
                            isFreilosConnection = true;
                        }
                    }
                });
            });
            
            if (isFreilosConnection) {
                connector.classList.add('freilos-line');
                connector.style.opacity = '0.5';
                connector.style.backgroundColor = '#555';
            }
        });
    }
    
    // Hilfsfunktion: Prüft ob Spiel Freilos enthält
    isFreilosGame(game) {
        const team1 = (game.team1 || '').toLowerCase().trim();
        const team2 = (game.team2 || '').toLowerCase().trim();
        return team1 === 'freilos' || team2 === 'freilos';
    }
    
    // KRITISCHER FIX: Force Refresh der Connectors
    forceRefresh() {
        console.log('🔄 Force refreshing connectors...');
        
        // Entferne und erstelle alle Connectors neu
        this.clearConnectors();
        
        // Kurze Verzögerung um sicherzustellen dass DOM updates verarbeitet wurden
        setTimeout(() => {
            this.createConnectors();
            this.updateConnectorStyles();
            
            // Debug nach Refresh
            setTimeout(() => {
                console.log(`🔄 Force refresh complete: ${this.connectors.length} connectors`);
                this.debugConnectors();
            }, 100);
        }, 50);
    }
    
    // Cleanup-Funktion
    destroy() {
        this.clearConnectors();
        this.rounds = [];
        this.bracketContainer = null;
        console.log('🗑️ Smart Connectors destroyed');
    }
}

// Global Instance
let smartConnectorInstance = null;

// KRITISCHER FIX: Haupt-Initialisierungsfunktion
function initializeSmartConnectors(smartRounds) {
    console.log('🔗 Initializing Smart Connectors with rounds:', smartRounds?.length || 0);
    
    if (!smartRounds || smartRounds.length === 0) {
        console.log('⏭️ No rounds provided for connectors');
        return;
    }
    
    // Debug: Zeige die Rundendaten
    console.log('📋 Smart Rounds Data:');
    smartRounds.forEach((round, index) => {
        console.log(`  Round ${index + 1} (${round.name}): ${round.gamePositions?.length || 0} games`);
        if (round.gamePositions && round.gamePositions.length > 0) {
            console.log(`    First game position:`, round.gamePositions[0]);
        }
    });
    
    // Erstelle oder verwende bestehende Instanz
    if (!smartConnectorInstance) {
        smartConnectorInstance = new SmartConnector();
    }
    
    // Initialisiere mit neuen Daten
    smartConnectorInstance.initialize(smartRounds);
    
    // Update Styles nach kurzer Verzögerung
    setTimeout(() => {
        if (smartConnectorInstance) {
            smartConnectorInstance.updateConnectorStyles();
            
            // KRITISCHER FIX: Falls keine Connectors erstellt wurden, force refresh
            if (smartConnectorInstance.connectors.length === 0) {
                console.log('⚠️ No connectors created, attempting force refresh...');
                smartConnectorInstance.forceRefresh();
            }
        }
    }, 200);
    
    // Debug nach weiterer Verzögerung
    setTimeout(() => {
        if (smartConnectorInstance) {
            console.log('🔍 Final connector debug:');
            smartConnectorInstance.debugConnectors();
        }
    }, 500);
}

// Reset-Funktion für neues Bracket
function resetSmartConnectors() {
    if (smartConnectorInstance) {
        smartConnectorInstance.destroy();
        smartConnectorInstance = null;
    }
    console.log('🔄 Smart Connectors reset');
}

// Team-Highlighting Integration
function highlightConnectorsForTeam(teamName) {
    if (smartConnectorInstance) {
        smartConnectorInstance.highlightTeamPath(teamName);
    }
}

function removeConnectorHighlights() {
    if (smartConnectorInstance) {
        smartConnectorInstance.removeHighlights();
    }
}

// Debug-Funktion
function debugSmartConnectors() {
    if (smartConnectorInstance) {
        smartConnectorInstance.debugConnectors();
    } else {
        console.log('❌ No Smart Connector instance available');
    }
}

// KRITISCHER FIX: Manual Connector Refresh
function refreshSmartConnectors() {
    if (smartConnectorInstance) {
        smartConnectorInstance.forceRefresh();
    } else {
        console.log('❌ No Smart Connector instance to refresh');
    }
}

// Event Listeners für Integration mit Team Highlighting
document.addEventListener('DOMContentLoaded', function() {
    // Integration mit Team Highlighting (falls verfügbar)
    const originalHighlightTeams = window.highlightAllTeams;
    const originalRemoveHighlight = window.removeHighlight;
    
    if (originalHighlightTeams) {
        window.highlightAllTeams = function(teamName) {
            originalHighlightTeams(teamName);
            highlightConnectorsForTeam(teamName);
        };
    }
    
    if (originalRemoveHighlight) {
        window.removeHighlight = function() {
            originalRemoveHighlight();
            removeConnectorHighlights();
        };
    }
    
    console.log('🔗 Smart Connectors integration loaded');
});

// KRITISCHER FIX: Keyboard shortcut für debugging
document.addEventListener('keydown', function(e) {
    if (e.key === 'c' && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        console.log('🔍 Manual connector debug triggered');
        debugSmartConnectors();
    }
    
    if (e.key === 'r' && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        console.log('🔄 Manual connector refresh triggered');
        refreshSmartConnectors();
    }
});

// Export Functions
window.initializeSmartConnectors = initializeSmartConnectors;
window.resetSmartConnectors = resetSmartConnectors;
window.highlightConnectorsForTeam = highlightConnectorsForTeam;
window.removeConnectorHighlights = removeConnectorHighlights;
window.debugSmartConnectors = debugSmartConnectors;
window.refreshSmartConnectors = refreshSmartConnectors;
window.SmartConnector = SmartConnector;