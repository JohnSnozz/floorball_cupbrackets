// Fullscreen Interaction - KORRIGIERTE VERSION mit zentraler Positionierung und korrekten Pannen-Grenzen

class FullscreenInteraction {
    constructor() {
        this.container = null;
        this.viewport = null;
        this.content = null;
        
        // Simple state
        this.isDragging = false;
        this.lastPos = { x: 0, y: 0 };
        this.position = { x: 0, y: 0 };
        this.zoom = 1;
        
        // Settings
        this.minZoom = 0.2;
        this.maxZoom = 3.0;
        this.zoomSpeed = 0.1;
        
        // Pannen ohne Einschränkungen
        this.panBuffer = 0; // Nicht mehr verwendet
        
        this.init();
    }
    
    init() {
        console.log('🎯 Starting FREE-PAN fullscreen interaction...');
        
        this.container = document.getElementById('fullscreenContainer');
        this.viewport = document.getElementById('bracketViewport');
        this.content = document.getElementById('bracketContent');
        
        if (!this.container || !this.viewport || !this.content) {
            console.error('❌ Missing elements');
            return;
        }
        
        this.setupEvents();
        // Warte mit der initialen Zentrierung bis das DOM vollständig geladen ist
        setTimeout(() => {
            this.reset(); // Start bei 100% zentriert
        }, 1000);
        
        console.log('✅ Free-pan interaction ready');
    }
    
    setupEvents() {
        // Mouse drag
        this.container.addEventListener('mousedown', (e) => {
            if (e.target.closest('a, button, .smart-match-link, .team')) return;
            
            this.isDragging = true;
            this.lastPos = { x: e.clientX, y: e.clientY };
            this.container.style.cursor = 'grabbing';
            this.container.classList.add('dragging');
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            
            const deltaX = e.clientX - this.lastPos.x;
            const deltaY = e.clientY - this.lastPos.y;
            
            this.position.x += deltaX;
            this.position.y += deltaY;
            
            this.lastPos = { x: e.clientX, y: e.clientY };
            
            this.update();
        });
        
        document.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.container.style.cursor = 'grab';
                this.container.classList.remove('dragging');
            }
        });
        
        // Mouse wheel zoom
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            const rect = this.container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const delta = e.deltaY > 0 ? -this.zoomSpeed : this.zoomSpeed;
            const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom + delta));
            
            if (newZoom !== this.zoom) {
                // Zoom toward mouse position
                const zoomFactor = newZoom / this.zoom;
                
                this.position.x = mouseX - (mouseX - this.position.x) * zoomFactor;
                this.position.y = mouseY - (mouseY - this.position.y) * zoomFactor;
                
                this.zoom = newZoom;
                this.update();
            }
        });
        
        // Zoom buttons
        document.getElementById('zoomIn')?.addEventListener('click', () => {
            this.zoomAtCenter(this.zoom + this.zoomSpeed);
        });
        
        document.getElementById('zoomOut')?.addEventListener('click', () => {
            this.zoomAtCenter(this.zoom - this.zoomSpeed);
        });
        
        document.getElementById('zoomReset')?.addEventListener('click', () => {
            this.autoFit();
        });
        
        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (e.target.matches('input, select, textarea')) return;
            
            switch(e.key) {
                case '+':
                case '=':
                    e.preventDefault();
                    this.zoomAtCenter(this.zoom + this.zoomSpeed);
                    break;
                case '-':
                    e.preventDefault();
                    this.zoomAtCenter(this.zoom - this.zoomSpeed);
                    break;
                case 'f':
                    e.preventDefault();
                    this.autoFit();
                    break;
                case '0':
                    e.preventDefault();
                    this.centerBracket();
                    break;
            }
        });
    }
    
    // NEUE FUNKTION: Zoom am Bildschirmzentrum
    zoomAtCenter(newZoom) {
        newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
        
        if (newZoom !== this.zoom) {
            const containerRect = this.container.getBoundingClientRect();
            const centerX = containerRect.width / 2;
            const centerY = containerRect.height / 2;
            
            const zoomFactor = newZoom / this.zoom;
            
            this.position.x = centerX - (centerX - this.position.x) * zoomFactor;
            this.position.y = centerY - (centerY - this.position.y) * zoomFactor;
            
            this.zoom = newZoom;
            this.update();
        }
    }
    
    update() {
        this.viewport.style.transform = `translate(${this.position.x}px, ${this.position.y}px) scale(${this.zoom})`;
        
        // Update display
        const display = document.getElementById('zoomLevel');
        if (display) {
            display.textContent = `${Math.round(this.zoom * 100)}%`;
        }
    }
    
    getBracket() {
        return this.content.querySelector('.smart-bracket');
    }
    
    // NEUE FUNKTION: Bracket zentrieren
   // NEUE FUNKTION: Bracket oben ausrichten statt zentrieren
centerBracket() {
    const bracket = this.getBracket();
    if (!bracket) {
        // Retry nach kurzer Verzögerung
        setTimeout(() => this.centerBracket(), 200);
        return;
    }
    
    const containerRect = this.container.getBoundingClientRect();
    const bracketW = bracket.offsetWidth;
    const bracketH = bracket.offsetHeight;
    
    // Horizontal zentrieren, vertikal oben ausrichten (mit kleinem Abstand)
    this.position.x = (containerRect.width - bracketW * this.zoom) / 2;
    this.position.y = 30; // 30px Abstand vom oberen Rand
    
    this.update();
    console.log('🎯 Bracket horizontal zentriert, vertikal oben ausgerichtet');
}

// ALTERNATIVE: Neue Funktion für Top-Center Ausrichtung
topCenterBracket() {
    const bracket = this.getBracket();
    if (!bracket) {
        setTimeout(() => this.topCenterBracket(), 200);
        return;
    }
    
    const containerRect = this.container.getBoundingClientRect();
    const bracketW = bracket.offsetWidth;
    
    // Horizontal zentrieren, vertikal oben mit Abstand
    this.position.x = (containerRect.width - bracketW * this.zoom) / 2;
    this.position.y = 50; // Größerer Abstand vom oberen Rand
    
    this.update();
    console.log('🎯 Bracket top-center ausgerichtet');
}

// Angepasste reset() Funktion
reset() {
    this.zoom = 1;
    this.topCenterBracket(); // Verwende neue Funktion statt centerBracket
    console.log('🎯 Reset to 100% top-center');
}

// Angepasste autoFit() Funktion
autoFit() {
    const bracket = this.getBracket();
    if (!bracket) {
        setTimeout(() => this.autoFit(), 200);
        return;
    }
    
    const containerRect = this.container.getBoundingClientRect();
    const bracketW = bracket.offsetWidth;
    const bracketH = bracket.offsetHeight;
    
    if (bracketW === 0 || bracketH === 0) {
        setTimeout(() => this.autoFit(), 200);
        return;
    }
    
    // Berechne beste Skalierung mit etwas Abstand (90% der verfügbaren Fläche)
    const scaleX = (containerRect.width * 0.9) / bracketW;
    const scaleY = (containerRect.height * 0.9) / bracketH;
    
    this.zoom = Math.min(scaleX, scaleY);
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom));
    
    // Nach dem Zoom oben-zentriert ausrichten statt komplett zentrieren
    this.topCenterBracket();
    
    console.log(`📏 Auto-fit: ${Math.round(this.zoom * 100)}% (top-center)`);
}
    
    // Public API
    autoFitBracket() {
        this.autoFit();
    }
    
    resetView() {
        this.reset();
    }
    
    zoomIn() {
        this.zoomAtCenter(this.zoom + this.zoomSpeed);
    }
    
    zoomOut() {
        this.zoomAtCenter(this.zoom - this.zoomSpeed);
    }
    
    refreshLimits() {
        this.update();
    }
    
    // NEUE FUNKTION: Debug-Informationen
    debugPosition() {
        const bracket = this.getBracket();
        if (!bracket) return;
        
        const containerRect = this.container.getBoundingClientRect();
        const bracketRect = bracket.getBoundingClientRect();
        
        console.log('🔍 Debug Position:', {
            container: { w: containerRect.width, h: containerRect.height },
            bracket: { w: bracket.offsetWidth, h: bracket.offsetHeight },
            bracketScaled: { w: bracket.offsetWidth * this.zoom, h: bracket.offsetHeight * this.zoom },
            position: { x: this.position.x, y: this.position.y },
            zoom: this.zoom,
            bracketVisible: {
                left: bracketRect.left,
                top: bracketRect.top,
                right: bracketRect.right,
                bottom: bracketRect.bottom
            }
        });
    }
}

// Initialize
let fullscreenInteraction = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Starting CORRECTED fullscreen interaction');
    fullscreenInteraction = new FullscreenInteraction();
    window.fullscreenInteraction = fullscreenInteraction;
});

// Hook into bracket loading - zentriert bei 100% ohne Auto-Fit
if (typeof window.loadSmartBracket === 'function') {
    const originalLoad = window.loadSmartBracket;
    window.loadSmartBracket = async function(...args) {
        const result = await originalLoad.apply(this, args);
        
        // Längere Wartezeit für vollständiges Rendering
        setTimeout(() => {
            if (fullscreenInteraction) {
                fullscreenInteraction.reset(); // 100% zentriert statt autoFit
            }
        }, 800); // Erhöht von 500ms auf 800ms
        
        return result;
    };
}

// Debug-Funktionen für Testing
window.debugFullscreenPosition = function() {
    if (fullscreenInteraction) {
        fullscreenInteraction.debugPosition();
    }
};

window.centerBracketManual = function() {
    if (fullscreenInteraction) {
        fullscreenInteraction.centerBracket();
    }
};

window.FullscreenInteraction = FullscreenInteraction;