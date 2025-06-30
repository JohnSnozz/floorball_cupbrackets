// Fullscreen Interaction - Einfache, funktionierende Version

class FullscreenInteraction {
    constructor() {
        this.container = null;
        this.viewport = null;
        this.content = null;
        
        // Pan State
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        this.currentPan = { x: 0, y: 0 };
        
        // Zoom State
        this.currentZoom = 1;
        this.minZoom = 0.3;
        this.maxZoom = 2.0;
        this.zoomStep = 0.1;
        
        // Touch State
        this.lastTouchDistance = 0;
        
        this.init();
    }
    
    init() {
        console.log('🎯 Initializing Fullscreen Interaction...');
        
        this.container = document.getElementById('fullscreenContainer');
        this.viewport = document.getElementById('bracketViewport');
        this.content = document.getElementById('bracketContent');
        
        if (!this.container || !this.viewport || !this.content) {
            console.error('❌ Required elements not found');
            return;
        }
        
        // Setze transform-origin explizit
        this.viewport.style.transformOrigin = 'top left';
        
        this.setupEventListeners();
        this.updateZoomDisplay();
        
        // Auto-fit nach kurzer Verzögerung
        setTimeout(() => {
            this.autoFitBracket();
        }, 500);
        
        console.log('✅ Fullscreen Interaction initialized');
    }
    
    setupEventListeners() {
        // Mouse Events
        this.container.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        
        // Wheel Event
        this.container.addEventListener('wheel', this.handleWheel.bind(this));
        
        // Touch Events
        this.container.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.container.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.container.addEventListener('touchend', this.handleTouchEnd.bind(this));
        
        // Zoom Buttons
        const zoomIn = document.getElementById('zoomIn');
        const zoomOut = document.getElementById('zoomOut');
        const zoomReset = document.getElementById('zoomReset');
        
        if (zoomIn) zoomIn.addEventListener('click', () => this.zoomIn());
        if (zoomOut) zoomOut.addEventListener('click', () => this.zoomOut());
        if (zoomReset) zoomReset.addEventListener('click', () => this.autoFitBracket());
        
        // Prevent context menu
        this.container.addEventListener('contextmenu', e => e.preventDefault());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }
    
    getBracketDimensions() {
        const bracketElement = this.content.querySelector('.smart-bracket');
        if (!bracketElement) {
            return { width: 1400, height: 800 };
        }
        
        // Hole die CSS-Dimensionen (die ursprünglichen, ungezooomten Werte)
        const style = window.getComputedStyle(bracketElement);
        const width = parseFloat(style.width) || 1400;
        const height = parseFloat(style.height) || 800;
        
        return { width, height };
    }
    
    getPanLimits() {
        const viewportRect = this.viewport.getBoundingClientRect();
        const bracketDims = this.getBracketDimensions();
        
        // Skalierte Bracket-Größe (mit aktuellem Zoom)
        const scaledWidth = bracketDims.width * this.currentZoom;
        const scaledHeight = bracketDims.height * this.currentZoom;
        
        // Berechne wie viel das Bracket über den Viewport hinausragt
        const overflowX = Math.max(0, scaledWidth - viewportRect.width);
        const overflowY = Math.max(0, scaledHeight - viewportRect.height);
        
        // Pan-Limits erklärt:
        // Positive Y-Werte = Bracket nach unten verschieben = oberen Teil sehen
        // Negative Y-Werte = Bracket nach oben verschieben = unteren Teil sehen
        const limits = {
            minX: overflowX > 0 ? -overflowX : 0,
            maxX: 0,
            minY: overflowY > 0 ? -overflowY : 0,  // Kann nach oben verschieben um unteren Teil zu sehen
            maxY: 0   // Kann nicht über den oberen Rand hinaus
        };
        
        // Debug-Ausgabe
        console.log('Pan Limits:', {
            zoom: `${Math.round(this.currentZoom * 100)}%`,
            bracketHeight: bracketDims.height,
            scaledHeight: Math.round(scaledHeight),
            viewportHeight: Math.round(viewportRect.height),
            overflowY: Math.round(overflowY),
            currentPanY: Math.round(this.currentPan.y),
            limits: {
                minY: Math.round(limits.minY),
                maxY: Math.round(limits.maxY)
            }
        });
        
        return limits;
    }
    
    constrainPan(x, y) {
        const limits = this.getPanLimits();
        
        return {
            x: Math.max(limits.minX, Math.min(limits.maxX, x)),
            y: Math.max(limits.minY, Math.min(limits.maxY, y))
        };
    }
    
    updateTransform() {
        const constrained = this.constrainPan(this.currentPan.x, this.currentPan.y);
        this.currentPan = constrained;
        
        // Transform mit transform-origin top left
        const transform = `translate(${constrained.x}px, ${constrained.y}px) scale(${this.currentZoom})`;
        this.viewport.style.transform = transform;
        this.viewport.style.transformOrigin = 'top left';
        
        // Debug info
        this.debugPanInfo();
    }
    
    debugPanInfo() {
        const bracketElement = this.content.querySelector('.smart-bracket');
        if (!bracketElement) return;
        
        const bracketRect = bracketElement.getBoundingClientRect();
        const viewportRect = this.viewport.getBoundingClientRect();
        
        console.log('🔍 Debug Pan Info:', {
            currentPan: { x: Math.round(this.currentPan.x), y: Math.round(this.currentPan.y) },
            bracketTop: Math.round(bracketRect.top),
            bracketBottom: Math.round(bracketRect.bottom),
            viewportTop: Math.round(viewportRect.top),
            viewportBottom: Math.round(viewportRect.bottom),
            visibleTop: Math.round(bracketRect.top - viewportRect.top),
            visibleBottom: Math.round(bracketRect.bottom - viewportRect.bottom)
        });
    }
    
    // Mouse Events
    handleMouseDown(e) {
        if (this.isClickableElement(e.target)) return;
        if (e.button !== 0) return;
        
        this.isPanning = true;
        this.panStart = {
            x: e.clientX - this.currentPan.x,
            y: e.clientY - this.currentPan.y
        };
        
        this.container.classList.add('dragging');
        e.preventDefault();
    }
    
    handleMouseMove(e) {
        if (!this.isPanning) return;
        
        this.currentPan = {
            x: e.clientX - this.panStart.x,
            y: e.clientY - this.panStart.y
        };
        
        this.updateTransform();
        e.preventDefault();
    }
    
    handleMouseUp(e) {
        if (!this.isPanning) return;
        
        this.isPanning = false;
        this.container.classList.remove('dragging');
    }
    
    handleWheel(e) {
        if (this.isClickableElement(e.target)) return;
        
        e.preventDefault();
        
        // Mausposition relativ zum Container
        const rect = this.container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Zoom-Richtung
        const delta = e.deltaY > 0 ? -this.zoomStep : this.zoomStep;
        
        // Alten Zoom speichern
        const oldZoom = this.currentZoom;
        
        // Neuen Zoom berechnen
        this.currentZoom = Math.max(this.minZoom, Math.min(this.maxZoom, oldZoom + delta));
        
        if (this.currentZoom !== oldZoom) {
            // Zoom-Verhältnis
            const zoomRatio = this.currentZoom / oldZoom;
            
            // Mausposition relativ zum Viewport-Center
            const viewportCenterX = rect.width / 2;
            const viewportCenterY = rect.height / 2;
            
            // Anpassen der Pan-Position, um an der Mausposition zu zoomen
            this.currentPan.x = mouseX - (mouseX - this.currentPan.x) * zoomRatio;
            this.currentPan.y = mouseY - (mouseY - this.currentPan.y) * zoomRatio;
            
            this.updateTransform();
            this.updateZoomDisplay();
        }
    }
    
    // Touch Events
    handleTouchStart(e) {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            this.isPanning = true;
            this.panStart = {
                x: touch.clientX - this.currentPan.x,
                y: touch.clientY - this.currentPan.y
            };
        } else if (e.touches.length === 2) {
            this.isPanning = false;
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            this.lastTouchDistance = this.getTouchDistance(touch1, touch2);
        }
        
        e.preventDefault();
    }
    
    handleTouchMove(e) {
        if (e.touches.length === 1 && this.isPanning) {
            const touch = e.touches[0];
            this.currentPan = {
                x: touch.clientX - this.panStart.x,
                y: touch.clientY - this.panStart.y
            };
            this.updateTransform();
        } else if (e.touches.length === 2) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const currentDistance = this.getTouchDistance(touch1, touch2);
            
            if (this.lastTouchDistance > 0) {
                const scale = currentDistance / this.lastTouchDistance;
                this.currentZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.currentZoom * scale));
                this.updateTransform();
                this.updateZoomDisplay();
            }
            
            this.lastTouchDistance = currentDistance;
        }
        
        e.preventDefault();
    }
    
    handleTouchEnd(e) {
        if (e.touches.length === 0) {
            this.isPanning = false;
            this.lastTouchDistance = 0;
        } else if (e.touches.length === 1) {
            this.lastTouchDistance = 0;
            const touch = e.touches[0];
            this.isPanning = true;
            this.panStart = {
                x: touch.clientX - this.currentPan.x,
                y: touch.clientY - this.currentPan.y
            };
        }
    }
    
    handleKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        
        switch (e.key) {
            case '+':
            case '=':
                e.preventDefault();
                this.zoomIn();
            case 'd':
                if (e.ctrlKey || e.shiftKey) {
                    e.preventDefault();
                    this.debugCurrentState();
                }
                break;
            case '-':
                e.preventDefault();
                this.zoomOut();
                break;
            case '0':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.autoFitBracket();
                }
                break;
            case 'f':
                e.preventDefault();
                this.autoFitBracket();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.currentPan.x += 50;
                this.updateTransform();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.currentPan.x -= 50;
                this.updateTransform();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.currentPan.y += 50;
                this.updateTransform();
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.currentPan.y -= 50;
                this.updateTransform();
                break;
        }
    }
    
    // Zoom Functions
    zoomIn() {
        this.currentZoom = Math.min(this.maxZoom, this.currentZoom + this.zoomStep);
        this.updateTransform();
        this.updateZoomDisplay();
    }
    
    zoomOut() {
        this.currentZoom = Math.max(this.minZoom, this.currentZoom - this.zoomStep);
        this.updateTransform();
        this.updateZoomDisplay();
    }
    
    autoFitBracket() {
        console.log('🎯 Auto-fitting bracket...');
        
        const viewportRect = this.viewport.getBoundingClientRect();
        const bracketDims = this.getBracketDimensions();
        
        // Berechne Zoom um das Bracket in den Viewport zu passen
        const scaleX = viewportRect.width / bracketDims.width;
        const scaleY = viewportRect.height / bracketDims.height;
        
        // Nimm das Minimum aber mit etwas Padding
        this.currentZoom = Math.min(scaleX, scaleY) * 0.9;
        this.currentZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.currentZoom));
        
        // Zentriere das Bracket
        this.currentPan = { x: 0, y: 0 };
        
        this.viewport.classList.add('smooth-transition');
        this.updateTransform();
        this.updateZoomDisplay();
        
        setTimeout(() => {
            this.viewport.classList.remove('smooth-transition');
        }, 300);
    }
    
    resetView() {
        this.autoFitBracket();
    }
    
    updateZoomDisplay() {
        const zoomDisplay = document.getElementById('zoomLevel');
        if (zoomDisplay) {
            zoomDisplay.textContent = `${Math.round(this.currentZoom * 100)}%`;
        }
    }
    
    isClickableElement(element) {
        let current = element;
        while (current && current !== this.container) {
            if (current.tagName === 'A' || 
                current.tagName === 'BUTTON' || 
                current.classList.contains('smart-match-link') ||
                current.classList.contains('team') ||
                current.closest('.smart-match-link')) {
                return true;
            }
            current = current.parentElement;
        }
        return false;
    }
    
    getTouchDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    debugCurrentState() {
        const viewportRect = this.viewport.getBoundingClientRect();
        const bracketElement = this.content.querySelector('.smart-bracket');
        const bracketRect = bracketElement ? bracketElement.getBoundingClientRect() : null;
        const limits = this.getPanLimits();
        
        console.log('🔍 VOLLSTÄNDIGER DEBUG STATE:');
        console.log('=====================================');
        console.log('Zoom:', `${Math.round(this.currentZoom * 100)}%`);
        console.log('Current Pan:', { x: Math.round(this.currentPan.x), y: Math.round(this.currentPan.y) });
        console.log('Pan Limits:', limits);
        
        if (bracketRect) {
            console.log('Bracket Position:', {
                top: Math.round(bracketRect.top),
                bottom: Math.round(bracketRect.bottom),
                height: Math.round(bracketRect.height)
            });
            console.log('Viewport Position:', {
                top: Math.round(viewportRect.top),
                bottom: Math.round(viewportRect.bottom),
                height: Math.round(viewportRect.height)
            });
            console.log('Sichtbarkeit:', {
                'Pixel über Viewport': Math.round(viewportRect.top - bracketRect.top),
                'Pixel unter Viewport': Math.round(bracketRect.bottom - viewportRect.bottom)
            });
        }
        console.log('=====================================');
    }
    
    // Public API für andere Scripts
    refreshLimits() {
        // Nach Bracket-Änderungen aufrufen
        this.updateTransform();
    }
}

// Initialize when DOM is ready
let fullscreenInteraction = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Fullscreen Interaction');
    fullscreenInteraction = new FullscreenInteraction();
    window.fullscreenInteraction = fullscreenInteraction;
});

// Export for global access
window.FullscreenInteraction = FullscreenInteraction;