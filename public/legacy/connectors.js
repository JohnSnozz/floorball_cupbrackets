// Verbindungslinien für Swiss Cup Brackets

function generateConnectionLines() {
    console.log('🔗 Generating connection lines...');
    
    // Entferne existierende Verbindungslinien
    document.querySelectorAll('.round-connections').forEach(el => el.remove());
    
    // Generiere Verbindungslinien für alle aufeinanderfolgenden Runden
    const allRounds = document.querySelectorAll('.round');
    
    for (let roundIndex = 0; roundIndex < allRounds.length - 1; roundIndex++) {
        const currentRound = allRounds[roundIndex];
        const nextRound = allRounds[roundIndex + 1];
        
        if (!currentRound || !nextRound) continue;
        
        const currentMatches = currentRound.querySelectorAll('.match');
        const nextMatches = nextRound.querySelectorAll('.match');
        
        if (currentMatches.length === 0) continue;
        
        // Container für Verbindungslinien erstellen
        const connectionsContainer = document.createElement('div');
        connectionsContainer.className = 'round-connections';
        connectionsContainer.style.position = 'absolute';
        connectionsContainer.style.top = '0';
        connectionsContainer.style.left = '0';
        connectionsContainer.style.width = '100%';
        connectionsContainer.style.height = '100%';
        connectionsContainer.style.pointerEvents = 'none';
        connectionsContainer.style.zIndex = '10';
        currentRound.appendChild(connectionsContainer);
        
        console.log(`Round ${roundIndex + 1} to ${roundIndex + 2}: ${currentMatches.length} -> ${nextMatches.length} matches`);
        
        // Für jeweils 2 Matches in aktueller Runde eine Verbindung zu 1 Match in nächster Runde
        for (let i = 0; i < currentMatches.length; i += 2) {
            const match1 = currentMatches[i];
            const match2 = currentMatches[i + 1];
            const targetMatch = nextMatches[Math.floor(i / 2)];
            
            if (!match1) continue;
            
            // Position der Matches ermitteln
            const match1Rect = match1.getBoundingClientRect();
            const match2Rect = match2 ? match2.getBoundingClientRect() : match1Rect;
            const containerRect = currentRound.getBoundingClientRect();
            
            const match1Center = match1Rect.top + match1Rect.height / 2 - containerRect.top;
            const match2Center = match2 ? (match2Rect.top + match2Rect.height / 2 - containerRect.top) : match1Center;
            
            // Horizontale Linie von Match 1
            const line1 = document.createElement('div');
            line1.className = 'connection-line horizontal';
            line1.style.position = 'absolute';
            line1.style.top = match1Center + 'px';
            line1.style.left = '180px';
            line1.style.width = '20px';
            line1.style.height = '2px';
            line1.style.backgroundColor = '#555';
            connectionsContainer.appendChild(line1);
            
            // Horizontale Linie von Match 2 (falls vorhanden)
            if (match2) {
                const line2 = document.createElement('div');
                line2.className = 'connection-line horizontal';
                line2.style.position = 'absolute';
                line2.style.top = match2Center + 'px';
                line2.style.left = '180px';
                line2.style.width = '20px';
                line2.style.height = '2px';
                line2.style.backgroundColor = '#555';
                connectionsContainer.appendChild(line2);
            }
            
            // Vertikale Verbindungslinie (nur wenn es 2 Matches gibt)
            if (match2) {
                const verticalLine = document.createElement('div');
                verticalLine.className = 'connection-line vertical';
                const verticalTop = Math.min(match1Center, match2Center);
                const verticalHeight = Math.abs(match2Center - match1Center);
                verticalLine.style.position = 'absolute';
                verticalLine.style.top = verticalTop + 'px';
                verticalLine.style.left = '200px';
                verticalLine.style.width = '2px';
                verticalLine.style.height = verticalHeight + 'px';
                verticalLine.style.backgroundColor = '#555';
                connectionsContainer.appendChild(verticalLine);
            }
            
            // Horizontale Linie zur nächsten Runde (nur wenn Ziel-Match existiert)
            if (targetMatch) {
                const toNextLine = document.createElement('div');
                toNextLine.className = 'connection-line to-next';
                const centerY = match2 ? (match1Center + match2Center) / 2 : match1Center;
                toNextLine.style.position = 'absolute';
                toNextLine.style.top = centerY + 'px';
                toNextLine.style.left = '200px';
                toNextLine.style.width = '20px';
                toNextLine.style.height = '2px';
                toNextLine.style.backgroundColor = '#555';
                connectionsContainer.appendChild(toNextLine);
            }
        }
    }
}

// Einfache Integration: Funktion wird manuell aufgerufen

// Exportiere Funktion für manuellen Aufruf
window.generateConnectionLines = generateConnectionLines;