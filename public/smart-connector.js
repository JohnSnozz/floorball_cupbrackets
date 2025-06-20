// Am Anfang der smart-match-link.js hinzufügen
let smartLinksInitialized = false;

function initializeSmartMatchLinks() {
    // Verhindere mehrfache Initialisierung
    if (smartLinksInitialized) {
        console.log('🔗 Smart match links bereits initialisiert, überspringe...');
        return;
    }
    
    console.log('🔗 Initialisiere Smart Match Links...');
    
    // Dein bestehender Code hier...
    
    // Markiere als initialisiert
    smartLinksInitialized = true;
}

// Reset-Funktion für neues Bracket
function resetSmartMatchLinks() {
    smartLinksInitialized = false;
}



function initializeConnectorHoverEvents() {
    console.log('🎯 Initializing connector hover events...');
    
    // NICHT die bestehenden Events entfernen - sie könnten von anderen Modulen stammen
    // removeConnectorHoverEvents();
    
    // Finde alle Smart Matches
    const smartMatches = document.querySelectorAll('.smart-match-absolute');
    
    smartMatches.forEach(matchElement => {
        const gameId = matchElement.getAttribute('data-bracket-sort');
        if (!gameId) return;
        
        // Prüfe ob bereits Connector-Events existieren
        if (matchElement.hasAttribute('data-connector-events')) return;
        
        // Markiere als initialisiert
        matchElement.setAttribute('data-connector-events', 'true');
        
        // Speichere ursprüngliche Event-Handler falls vorhanden
        const originalMouseEnter = matchElement.onmouseenter;
        const originalMouseLeave = matchElement.onmouseleave;
        
        // Kombiniere Events
        matchElement.addEventListener('mouseenter', function(e) {
            // Führe ursprüngliche Events aus (Team-Highlighting)
            if (originalMouseEnter) originalMouseEnter.call(this, e);
            
            // Füge Connector-Highlighting hinzu
            highlightConnectorPath(gameId);
        });
        
        matchElement.addEventListener('mouseleave', function(e) {
            // Führe ursprüngliche Events aus
            if (originalMouseLeave) originalMouseLeave.call(this, e);
            
            // Entferne Connector-Highlighting
            removeConnectorHighlight();
        });
    });
    
    console.log(`✅ Connector hover events initialized for ${smartMatches.length} matches`);
}

function highlightConnectorPath(gameId) {
    if (!currentSmartRounds) return;
    
    // Finde alle Connector die zu diesem Spiel führen (rückwärts)
    const pathGameIds = findPathToGame(gameId);
    
    // Entferne vorherige Highlights
    removeConnectorHighlight();
    
    // Highlighte alle Connector die Teil des Pfads sind
    pathGameIds.forEach(pathGameId => {
        const connectors = document.querySelectorAll(`[data-target-game="${pathGameId}"]`);
        connectors.forEach(connector => {
            connector.classList.add('highlight-path');
        });
    });
}

function findPathToGame(targetGameId) {
    const pathGameIds = [targetGameId];
    const targetSortOrder = parseInt(targetGameId);
    
    // Arbeite rückwärts durch die Runden
    for (let roundIndex = currentSmartRounds.length - 1; roundIndex >= 0; roundIndex--) {
        const currentRound = currentSmartRounds[roundIndex];
        
        // Prüfe ob das aktuelle Ziel in dieser Runde ist
        const gameInRound = currentRound.gamePositions.find(pos => 
            parseInt(pos.game.bracketSortOrder) === targetSortOrder
        );
        
        if (gameInRound) {
            // Finde Vorgänger für dieses Spiel
            const pred1SortOrder = (targetSortOrder * 2) - 1;
            const pred2SortOrder = targetSortOrder * 2;
            
            // Prüfe vorherige Runde für Vorgänger
            if (roundIndex > 0) {
                const prevRound = currentSmartRounds[roundIndex - 1];
                
                const pred1 = prevRound.gamePositions.find(pos => 
                    parseInt(pos.game.bracketSortOrder) === pred1SortOrder
                );
                const pred2 = prevRound.gamePositions.find(pos => 
                    parseInt(pos.game.bracketSortOrder) === pred2SortOrder
                );
                
                if (pred1) pathGameIds.push(pred1.game.bracketSortOrder);
                if (pred2) pathGameIds.push(pred2.game.bracketSortOrder);
            }
            break;
        }
    }
    
    return pathGameIds;
}

function removeConnectorHighlight() {
    const highlightedConnectors = document.querySelectorAll('.smart-connector.highlight-path');
    highlightedConnectors.forEach(connector => {
        connector.classList.remove('highlight-path');
    });
}

function removeConnectorHoverEvents() {
    // Entferne nur die Connector-spezifischen Attribute und Highlights
    const smartMatches = document.querySelectorAll('.smart-match-absolute[data-connector-events]');
    smartMatches.forEach(element => {
        element.removeAttribute('data-connector-events');
    });
    
    // Entferne alle aktiven Connector-Highlights
    removeConnectorHighlight();
}// Smart Connector - Verbindungslinien für Swiss Cup Smart Brackets

let connectorDebugMode = false;
let currentSmartRounds = null; // Speichere die Runden für Hover-Funktionalität

function initializeSmartConnectors(smartRounds) {
    console.log('🔗 Initializing smart connectors...');
    
    // Speichere Runden für spätere Verwendung
    currentSmartRounds = smartRounds;
    
    // Entferne alle existierenden Connector
    removeSmartConnectors();
    
    if (!smartRounds || smartRounds.length < 2) {
        console.log('❌ Not enough rounds for connectors');
        return;
    }
    
    let connectorCount = 0;
    
    // Durchlaufe alle Runden außer der letzten
    for (let i = 0; i < smartRounds.length - 1; i++) {
        const currentRound = smartRounds[i];
        const nextRound = smartRounds[i + 1];
        
        if (!nextRound) continue;
        
        console.log(`🔄 Processing connectors from round ${i} to round ${i + 1}`);
        
        // Für jedes Spiel in der nächsten Runde finde die Vorgänger
        nextRound.gamePositions.forEach(nextGamePos => {
            const connectors = createConnectorsForGame(nextGamePos, currentRound);
            connectors.forEach(connector => {
                // Füge Metadaten für Hover-Funktionalität hinzu
                connector.targetGameId = nextGamePos.game.bracketSortOrder;
                addConnectorToDOM(connector);
                connectorCount++;
            });
        });
    }
    
    // Initialisiere Hover-Events nach Connector-Erstellung
    initializeConnectorHoverEvents();
    
    console.log(`✅ Created ${connectorCount} smart connectors`);
}

function createConnectorsForGame(nextGamePos, currentRound) {
    const connectors = [];
    const nextGame = nextGamePos.game;
    const nextSortOrder = parseInt(nextGame.bracketSortOrder);
    
    // Berechne erwartete Vorgänger-SortOrders
    const pred1SortOrder = (nextSortOrder * 2) - 1;
    const pred2SortOrder = nextSortOrder * 2;
    
    // Finde Vorgänger-Spiele
    const pred1 = currentRound.gamePositions.find(pos => 
        parseInt(pos.game.bracketSortOrder) === pred1SortOrder
    );
    const pred2 = currentRound.gamePositions.find(pos => 
        parseInt(pos.game.bracketSortOrder) === pred2SortOrder
    );
    
    if (connectorDebugMode) {
        console.log(`🔍 Game ${nextSortOrder}: pred1=${pred1SortOrder}, pred2=${pred2SortOrder}`);
        console.log(`   Found pred1: ${!!pred1}, pred2: ${!!pred2}`);
    }
    
    if (pred1 && pred2) {
        // Zwei Vorgänger → Standard Bracket-Verbindung
        connectors.push(...createDualConnectors(pred1, pred2, nextGamePos));
    } else if (pred1 || pred2) {
        // Ein Vorgänger → Direkte Verbindung (Freilos-Fall)
        const predecessor = pred1 || pred2;
        connectors.push(createSingleConnector(predecessor, nextGamePos));
    }
    
    return connectors;
}

function createDualConnectors(pred1Pos, pred2Pos, nextGamePos) {
    const connectors = [];
    const HALF_ROUND_GAP = 20; // Hälfte des Rundenabstands (40/2)
    
    // Berechne Mittelpunkte der Spiele (rechte Mitte für Vorgänger, linke Mitte für Nachfolger)
    const pred1Center = {
        x: pred1Pos.x + pred1Pos.width,
        y: pred1Pos.y + (pred1Pos.height / 2)
    };
    
    const pred2Center = {
        x: pred2Pos.x + pred2Pos.width,
        y: pred2Pos.y + (pred2Pos.height / 2)
    };
    
    const nextCenter = {
        x: nextGamePos.x,
        y: nextGamePos.y + (nextGamePos.height / 2)
    };
    
    // 1. Horizontale Linien aus den Vorgängern
    const outX = pred1Center.x + HALF_ROUND_GAP;
    
    connectors.push({
        type: 'horizontal',
        className: 'out-line',
        x: pred1Center.x,
        y: pred1Center.y - 1, // -1 für Liniendicke zentrieren
        width: HALF_ROUND_GAP,
        height: 2
    });
    
    connectors.push({
        type: 'horizontal',
        className: 'out-line',
        x: pred2Center.x,
        y: pred2Center.y - 1,
        width: HALF_ROUND_GAP,
        height: 2
    });
    
    // 2. Vertikale Verbindung
    const topY = Math.min(pred1Center.y, pred2Center.y);
    const bottomY = Math.max(pred1Center.y, pred2Center.y);
    
    if (topY !== bottomY) {
        connectors.push({
            type: 'vertical',
            className: 'vertical-bridge',
            x: outX - 1, // -1 für Liniendicke zentrieren
            y: topY,
            width: 2,
            height: bottomY - topY
        });
    }
    
    // 3. Horizontale Linie zum Nachfolger
    connectors.push({
        type: 'horizontal',
        className: 'in-line',
        x: outX,
        y: nextCenter.y - 1,
        width: nextCenter.x - outX,
        height: 2
    });
    
    return connectors;
}

function createSingleConnector(predPos, nextGamePos) {
    // Direkte horizontale Verbindung (Freilos-Fall)
    const predCenter = {
        x: predPos.x + predPos.width,
        y: predPos.y + (predPos.height / 2)
    };
    
    const nextCenter = {
        x: nextGamePos.x,
        y: nextGamePos.y + (nextGamePos.height / 2)
    };
    
    return {
        type: 'horizontal',
        className: 'freilos-line',
        x: predCenter.x,
        y: predCenter.y - 1,
        width: nextCenter.x - predCenter.x,
        height: 2
    };
}

function addConnectorToDOM(connector) {
    const smartBracket = document.querySelector('.smart-bracket');
    if (!smartBracket) {
        console.error('❌ Smart bracket container not found');
        return;
    }
    
    const connectorElement = document.createElement('div');
    connectorElement.className = `smart-connector ${connector.type} ${connector.className}`;
    connectorElement.style.position = 'absolute';
    connectorElement.style.left = `${connector.x}px`;
    connectorElement.style.top = `${connector.y}px`;
    connectorElement.style.width = `${connector.width}px`;
    connectorElement.style.height = `${connector.height}px`;
    
    // Füge Metadaten als data-Attribute hinzu
    if (connector.targetGameId) {
        connectorElement.setAttribute('data-target-game', connector.targetGameId);
    }
    if (connector.sourceGameId) {
        connectorElement.setAttribute('data-source-game', connector.sourceGameId);
    }
    
    if (connectorDebugMode) {
        connectorElement.title = `${connector.className}: ${connector.x},${connector.y} ${connector.width}x${connector.height}`;
    }
    
    smartBracket.appendChild(connectorElement);
}

function removeSmartConnectors() {
    const existingConnectors = document.querySelectorAll('.smart-connector');
    existingConnectors.forEach(connector => {
        connector.remove();
    });
    
    // Entferne auch Hover Events
    removeConnectorHoverEvents();
}

function refreshSmartConnectors(smartRounds) {
    console.log('🔄 Refreshing smart connectors...');
    removeSmartConnectors();
    setTimeout(() => initializeSmartConnectors(smartRounds), 100);
}

function toggleConnectorDebugMode() {
    connectorDebugMode = !connectorDebugMode;
    const smartBracket = document.querySelector('.smart-bracket');
    if (smartBracket) {
        if (connectorDebugMode) {
            smartBracket.classList.add('debug-smart-connectors');
        } else {
            smartBracket.classList.remove('debug-smart-connectors');
        }
    }
    console.log(`🔧 Connector debug mode: ${connectorDebugMode ? 'ON' : 'OFF'}`);
}

function debugSmartConnectors() {
    console.log('\n🔍 DEBUG: Smart Connectors');
    const connectors = document.querySelectorAll('.smart-connector');
    console.log(`Found ${connectors.length} connector elements`);
    
    connectors.forEach((connector, index) => {
        const rect = connector.getBoundingClientRect();
        console.log(`${index + 1}. Connector:`, {
            className: connector.className,
            x: connector.style.left,
            y: connector.style.top,
            width: connector.style.width,
            height: connector.style.height,
            title: connector.title
        });
    });
}

// Keyboard shortcuts für Debug
document.addEventListener('keydown', function(e) {
    if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        debugSmartConnectors();
    }
    
    if (e.key === 'C' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        toggleConnectorDebugMode();
    }
});

// Exportiere Funktionen für externen Aufruf
window.initializeSmartConnectors = initializeSmartConnectors;
window.removeSmartConnectors = removeSmartConnectors;
window.refreshSmartConnectors = refreshSmartConnectors;
window.toggleConnectorDebugMode = toggleConnectorDebugMode;
window.debugSmartConnectors = debugSmartConnectors;
window.initializeConnectorHoverEvents = initializeConnectorHoverEvents;