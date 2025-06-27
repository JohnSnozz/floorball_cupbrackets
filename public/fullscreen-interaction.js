// Fullscreen Interaction - Pan und Zoom für Bracket
// Behandelt Maus-Interaktionen für das Bracket ohne Links zu beeinträchtigen

class FullscreenInteraction {
    constructor() {
        this.container = null;
        this.viewport = null;
        this.content = null;
        
        // Pan State - Vereinfacht für bessere Performance
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        this.panOffset = { x: 0, y: 0 };
        this.lastPanOffset = { x: 0, y: 0 };
        
        // Zoom State
        this.zoomLevel = 1;
        this.minZoom = 0.1;
        this.maxZoom = 3;
        this.zoomStep = 0.1;
        
        // Touch State für Mobile
        this.lastTouchDistance = 0;
        this.touchCenter = { x: 0, y: 0 };
        
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
    
    this.setupEventListeners();
    this.updateZoomDisplay();
    
    // Initial auto-fit nach kurzer Verzögerung - NEU!
    setTimeout(() => {
        this.autoFitBracket();
    }, 1000);
    
    console.log('✅ Fullscreen Interaction initialized');
}
    
    setupEventListeners() {
        // Mouse Events
        this.container.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        
        // Wheel Event für Zoom
        this.container.addEventListener('wheel', this.handleWheel.bind(this));
        
        // Touch Events für Mobile
        this.container.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.container.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.container.addEventListener('touchend', this.handleTouchEnd.bind(this));
        
        // Zoom Button Events
        this.setupZoomButtons();
        
        // Prevent context menu
        this.container.addEventListener('contextmenu', e => e.preventDefault());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }
    
    setupZoomButtons() {
        const zoomIn = document.getElementById('zoomIn');
        const zoomOut = document.getElementById('zoomOut');
        const zoomReset = document.getElementById('zoomReset');
        
        if (zoomIn) zoomIn.addEventListener('click', () => this.zoomIn());
        if (zoomOut) zoomOut.addEventListener('click', () => this.zoomOut());
        if (zoomReset) zoomReset.addEventListener('click', () => this.resetView());
    }
    
    // Mouse Events
    handleMouseDown(e) {
        // Ignore if clicking on links or buttons
        if (this.isClickableElement(e.target)) {
            return;
        }
        
        // Nur linke Maustaste für Panning
        if (e.button !== 0) return;
        
        this.isPanning = true;
        this.panStart.x = e.clientX - this.panOffset.x;
        this.panStart.y = e.clientY - this.panOffset.y;
        
        this.container.classList.add('dragging');
        e.preventDefault();
    }
    
    handleMouseMove(e) {
        if (!this.isPanning) return;
        
        this.panOffset.x = e.clientX - this.panStart.x;
        this.panOffset.y = e.clientY - this.panStart.y;
        
        this.updateTransform();
        e.preventDefault();
    }
    
    handleMouseUp(e) {
        if (!this.isPanning) return;
        
        this.isPanning = false;
        this.lastPanOffset.x = this.panOffset.x;
        this.lastPanOffset.y = this.panOffset.y;
        
        this.container.classList.remove('dragging');
    }
    
    // Wheel Event für Zoom
    handleWheel(e) {
        if (this.isClickableElement(e.target)) {
            return;
        }
        
        e.preventDefault();
        
        const rect = this.container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const delta = e.deltaY > 0 ? -this.zoomStep : this.zoomStep;
        this.zoomAt(mouseX, mouseY, delta);
    }
    
    // Touch Events für Mobile
    handleTouchStart(e) {
        if (e.touches.length === 1) {
            // Single touch - Pan
            const touch = e.touches[0];
            this.isPanning = true;
            this.panStart.x = touch.clientX - this.panOffset.x;
            this.panStart.y = touch.clientY - this.panOffset.y;
        } else if (e.touches.length === 2) {
            // Two touches - Zoom
            this.isPanning = false;
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            
            this.lastTouchDistance = this.getTouchDistance(touch1, touch2);
            this.touchCenter = this.getTouchCenter(touch1, touch2);
        }
        
        e.preventDefault();
    }
    
    handleTouchMove(e) {
        if (e.touches.length === 1 && this.isPanning) {
            // Single touch - Pan
            const touch = e.touches[0];
            this.panOffset.x = touch.clientX - this.panStart.x;
            this.panOffset.y = touch.clientY - this.panStart.y;
            this.updateTransform();
        } else if (e.touches.length === 2) {
            // Two touches - Zoom
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            
            const currentDistance = this.getTouchDistance(touch1, touch2);
            const currentCenter = this.getTouchCenter(touch1, touch2);
            
            if (this.lastTouchDistance > 0) {
                const zoomDelta = (currentDistance - this.lastTouchDistance) * 0.01;
                const rect = this.container.getBoundingClientRect();
                const mouseX = currentCenter.x - rect.left;
                const mouseY = currentCenter.y - rect.top;
                
                this.zoomAt(mouseX, mouseY, zoomDelta);
            }
            
            this.lastTouchDistance = currentDistance;
            this.touchCenter = currentCenter;
        }
        
        e.preventDefault();
    }
    
    handleTouchEnd(e) {
        if (e.touches.length === 0) {
            this.isPanning = false;
            this.lastTouchDistance = 0;
            this.lastPanOffset.x = this.panOffset.x;
            this.lastPanOffset.y = this.panOffset.y;
        } else if (e.touches.length === 1) {
            // Switch from zoom to pan
            this.lastTouchDistance = 0;
            const touch = e.touches[0];
            this.isPanning = true;
            this.panStart.x = touch.clientX - this.panOffset.x;
            this.panStart.y = touch.clientY - this.panOffset.y;
        }
    }
    
    // Keyboard Shortcuts
    handleKeyDown(e) {
        // Ignore if typing in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
            return;
        }
        
        switch (e.key) {
            case '+':
            case '=':
                e.preventDefault();
                this.zoomIn();
                break;
            case '-':
                e.preventDefault();
                this.zoomOut();
                break;
            case '0':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.resetView();
                }
                break;
            case 'Home':
                e.preventDefault();
                this.centerView();
                break;
        }
    }
    
    // Zoom Functions
    zoomIn() {
        const rect = this.container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        this.zoomAt(centerX, centerY, this.zoomStep);
    }
    
    zoomOut() {
        const rect = this.container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        this.zoomAt(centerX, centerY, -this.zoomStep);
    }
    
    zoomAt(mouseX, mouseY, delta) {
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel + delta));
        
        if (newZoom === this.zoomLevel) return;
        
        // Berechne Zoom-Center relativ zum Viewport
        const zoomFactor = newZoom / this.zoomLevel;
        
        // Anpassung der Pan-Offset für Zoom am Maus-Punkt
        const rect = this.viewport.getBoundingClientRect();
        const viewportCenterX = rect.width / 2;
        const viewportCenterY = rect.height / 2;
        
        // Berechne neuen Offset um den Zoom-Punkt
        const deltaX = (mouseX - viewportCenterX) * (1 - zoomFactor);
        const deltaY = (mouseY - viewportCenterY) * (1 - zoomFactor);
        
        this.panOffset.x += deltaX;
        this.panOffset.y += deltaY;
        this.lastPanOffset.x = this.panOffset.x;
        this.lastPanOffset.y = this.panOffset.y;
        
        this.zoomLevel = newZoom;
        this.updateTransform();
        this.updateZoomDisplay();
    }
    
    resetView() {
        this.zoomLevel = 0.8;
        this.panOffset.x = 0;
        this.panOffset.y = 0;
        this.lastPanOffset.x = 0;
        this.lastPanOffset.y = 0;
        
        this.viewport.classList.add('smooth-transition');
        this.updateTransform();
        this.updateZoomDisplay();
        
        setTimeout(() => {
            this.viewport.classList.remove('smooth-transition');
        }, 300);
    }
    
    centerView() {
        this.panOffset.x = 0;
        this.panOffset.y = 0;
        this.lastPanOffset.x = 0;
        this.lastPanOffset.y = 0;
        
        this.viewport.classList.add('smooth-transition');
        this.updateTransform();
        
        setTimeout(() => {
            this.viewport.classList.remove('smooth-transition');
        }, 300);
    }
    
    // Transform Update
    updateTransform() {
        const transform = `translate(${this.panOffset.x}px, ${this.panOffset.y}px) scale(${this.zoomLevel})`;
        this.viewport.style.transform = transform;
    }
    
    updateZoomDisplay() {
        const zoomDisplay = document.getElementById('zoomLevel');
        if (zoomDisplay) {
            zoomDisplay.textContent = `${Math.round(this.zoomLevel * 100)}%`;
        }
    }
    
    // Helper Functions
    isClickableElement(element) {
        // Prüfe ob Element oder Parent ein Link/Button ist
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
    
    getTouchCenter(touch1, touch2) {
        return {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2
        };
    }
    
    // Public API
    setZoom(level) {
        this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, level));
        this.updateTransform();
        this.updateZoomDisplay();
    }
    
    getZoom() {
        return this.zoomLevel;
    }
    
    setPan(x, y) {
        this.panOffset.x = x;
        this.panOffset.y = y;
        this.lastPanOffset.x = x;
        this.lastPanOffset.y = y;
        this.updateTransform();
    }
    
    getPan() {
        return { x: this.panOffset.x, y: this.panOffset.y };
    }
    
    // Auto-fit Bracket nach dem Laden - VERBESSERTE VERSION
autoFitBracket() {
    console.log('🎯 Auto-fitting bracket...');
    
    const bracketElement = document.querySelector('.smart-bracket');
    if (!bracketElement) {
        console.log('❌ No bracket element found for auto-fit');
        return;
    }
    
    // Warte bis Bracket vollständig gerendert ist
    setTimeout(() => {
        // Force reflow um sicherzustellen dass Dimensionen korrekt sind
        bracketElement.offsetHeight;
        
        const bracketRect = bracketElement.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();
        
        console.log('📏 Bracket dimensions:', {
            bracket: { width: bracketRect.width, height: bracketRect.height },
            container: { width: containerRect.width, height: containerRect.height },
            bracketStyle: { 
                width: bracketElement.style.width, 
                height: bracketElement.style.height 
            }
        });
        
        // Verwende Style-Dimensionen falls vorhanden, sonst getBoundingClientRect
        let bracketWidth = bracketRect.width;
        let bracketHeight = bracketRect.height;
        
        // Fallback zu Style-Dimensionen wenn getBoundingClientRect 0 zurückgibt
        if (bracketWidth === 0 && bracketElement.style.width) {
            bracketWidth = parseFloat(bracketElement.style.width);
        }
        if (bracketHeight === 0 && bracketElement.style.height) {
            bracketHeight = parseFloat(bracketElement.style.height);
        }
        
        console.log('📏 Final dimensions:', { width: bracketWidth, height: bracketHeight });
        
        if (bracketWidth > 0 && bracketHeight > 0) {
            // Berechne optimalen Zoom um das ganze Bracket zu sehen
            const padding = 100; // Padding für bessere Sicht
            const scaleX = (containerRect.width - padding) / bracketWidth;
            const scaleY = (containerRect.height - padding) / bracketHeight;
            const optimalZoom = Math.min(scaleX, scaleY, 1.0); // Max 100%
            
            // Mindest-Zoom für Lesbarkeit
            const finalZoom = Math.max(this.minZoom, optimalZoom);
            
            this.zoomLevel = finalZoom;
            this.panOffset.x = 0;
            this.panOffset.y = 0;
            this.lastPanOffset.x = 0;
            this.lastPanOffset.y = 0;
            
            this.viewport.classList.add('smooth-transition');
            this.updateTransform();
            this.updateZoomDisplay();
            
            setTimeout(() => {
                this.viewport.classList.remove('smooth-transition');
            }, 300);
            
            console.log(`✅ Auto-fit complete: ${Math.round(finalZoom * 100)}% (scale factors: ${scaleX.toFixed(2)}, ${scaleY.toFixed(2)})`);
        } else {
            console.log('❌ Invalid bracket dimensions for auto-fit');
            // Fallback zu Standard-Reset
            this.resetView();
        }
    }, 300); // Längere Verzögerung für vollständiges Rendering
}
}

// Initialize when DOM is ready
let fullscreenInteraction = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Fullscreen Interaction on DOMContentLoaded');
    fullscreenInteraction = new FullscreenInteraction();
});

// Export for global access
window.FullscreenInteraction = FullscreenInteraction;
window.fullscreenInteraction = fullscreenInteraction;