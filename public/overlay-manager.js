// Overlay Manager - Verwaltung der Overlay-Controls
// Behandelt das Ein-/Ausblenden und die Interaktion mit den Overlay-Controls

class OverlayManager {
    constructor() {
        this.overlayControls = null;
        this.toggleButton = null;
        this.loadingOverlay = null;
        this.isCollapsed = false;
        this.autoHideTimeout = null;
        this.autoHideDelay = 5000; // 5 Sekunden
        
        this.init();
    }
    
    init() {
        console.log('🎛️ Initializing Overlay Manager...');
        
        this.overlayControls = document.getElementById('overlayControls');
        this.toggleButton = document.getElementById('toggleControls');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        
        if (!this.overlayControls || !this.toggleButton) {
            console.error('❌ Overlay elements not found');
            return;
        }
        
        this.setupEventListeners();
        this.setupAutoHide();
        
        console.log('✅ Overlay Manager initialized');
    }
    
    setupEventListeners() {
        // Toggle Button
        this.toggleButton.addEventListener('click', this.toggleControls.bind(this));
        
        // Auto-hide on mouse leave
        this.overlayControls.addEventListener('mouseenter', this.cancelAutoHide.bind(this));
        this.overlayControls.addEventListener('mouseleave', this.startAutoHide.bind(this));
        
        // Prevent auto-hide when interacting with controls
        this.overlayControls.addEventListener('focusin', this.cancelAutoHide.bind(this));
        this.overlayControls.addEventListener('focusout', this.startAutoHide.bind(this));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeydown.bind(this));
        
        // Show controls on mouse move (when hidden)
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        
        // Override original loadSmartBracket to show loading
        this.overrideLoadFunction();
    }
    
    setupAutoHide() {
        // Start auto-hide timer initially
        this.startAutoHide();
    }
    
    toggleControls() {
        this.isCollapsed = !this.isCollapsed;
        
        if (this.isCollapsed) {
            this.overlayControls.classList.add('collapsed');
            this.cancelAutoHide();
        } else {
            this.overlayControls.classList.remove('collapsed');
            this.startAutoHide();
        }
        
        console.log(`🎛️ Controls ${this.isCollapsed ? 'collapsed' : 'expanded'}`);
    }
    
    showControls() {
        if (this.isCollapsed) {
            this.toggleControls();
        }
        this.cancelAutoHide();
        this.startAutoHide();
    }
    
    hideControls() {
        if (!this.isCollapsed) {
            this.toggleControls();
        }
    }
    
    startAutoHide() {
        this.cancelAutoHide();
        
        if (!this.isCollapsed) {
            this.autoHideTimeout = setTimeout(() => {
                this.hideControls();
            }, this.autoHideDelay);
        }
    }
    
    cancelAutoHide() {
        if (this.autoHideTimeout) {
            clearTimeout(this.autoHideTimeout);
            this.autoHideTimeout = null;
        }
    }
    
    handleKeydown(e) {
        // Toggle controls with ESC or Space
        if (e.key === 'Escape' || (e.key === ' ' && !this.isInputFocused())) {
            e.preventDefault();
            this.toggleControls();
        }
        
        // Show controls with any key (if hidden)
        if (this.isCollapsed && !this.isInputFocused()) {
            this.showControls();
        }
    }
    
    handleMouseMove(e) {
        // Show controls if mouse is near top-left corner
        if (this.isCollapsed && e.clientX < 100 && e.clientY < 100) {
            this.showControls();
        }
    }
    
    isInputFocused() {
        const activeElement = document.activeElement;
        return activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'SELECT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.contentEditable === 'true'
        );
    }
    
    // Loading Overlay Management
    showLoading(text = 'Lade Bracket...') {
        if (this.loadingOverlay) {
            const loadingText = this.loadingOverlay.querySelector('.loading-text');
            if (loadingText) {
                loadingText.textContent = text;
            }
            this.loadingOverlay.classList.add('visible');
        }
        
        // Disable controls during loading
        const controlsPanel = this.overlayControls?.querySelector('.controls-panel');
        if (controlsPanel) {
            controlsPanel.classList.add('loading');
        }
    }
    
    hideLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.classList.remove('visible');
        }
        
        // Re-enable controls
        const controlsPanel = this.overlayControls?.querySelector('.controls-panel');
        if (controlsPanel) {
            controlsPanel.classList.remove('loading');
        }
    }
    
    // Override original loadSmartBracket function
    overrideLoadFunction() {
        // Store original function
        if (typeof window.loadSmartBracket === 'function') {
            const originalLoad = window.loadSmartBracket;
            
            window.loadSmartBracket = async (...args) => {
                console.log('🔄 Loading with overlay...');
                this.showLoading();
                
                try {
                    const result = await originalLoad.apply(this, args);
                    
                    // Force recentering after load
                    setTimeout(() => {
                        if (window.fullscreenInteraction) {
                            window.fullscreenInteraction.resetView();
                        }
                    }, 200);
                    
                    return result;
                } catch (error) {
                    console.error('❌ Loading error:', error);
                } finally {
                    // Hide loading with delay to show result
                    setTimeout(() => {
                        this.hideLoading();
                    }, 500);
                }
            };
            
            console.log('✅ loadSmartBracket function overridden');
        } else {
            // Wait for function to be available
            setTimeout(() => {
                this.overrideLoadFunction();
            }, 100);
        }
    }
    
    // Utility Methods
    setAutoHideDelay(delay) {
        this.autoHideDelay = delay;
    }
    
    disableAutoHide() {
        this.cancelAutoHide();
        this.autoHideDelay = 0;
    }
    
    enableAutoHide(delay = 5000) {
        this.autoHideDelay = delay;
        this.startAutoHide();
    }
    
    // Public API
    isControlsVisible() {
        return !this.isCollapsed;
    }
    
    forceShow() {
        this.cancelAutoHide();
        if (this.isCollapsed) {
            this.toggleControls();
        }
    }
    
    forceHide() {
        this.cancelAutoHide();
        if (!this.isCollapsed) {
            this.toggleControls();
        }
    }
}

// Enhanced loading wrapper for better UX
class LoadingManager {
    constructor() {
        this.isLoading = false;
        this.loadingQueue = [];
    }
    
    async wrapWithLoading(asyncFunction, loadingText = 'Lädt...') {
        if (this.isLoading) {
            console.log('⏳ Already loading, queuing request...');
            return new Promise((resolve, reject) => {
                this.loadingQueue.push({ asyncFunction, loadingText, resolve, reject });
            });
        }
        
        this.isLoading = true;
        
        if (window.overlayManager) {
            window.overlayManager.showLoading(loadingText);
        }
        
        try {
            const result = await asyncFunction();
            
            // Process queue
            if (this.loadingQueue.length > 0) {
                const next = this.loadingQueue.shift();
                setTimeout(async () => {
                    try {
                        const queueResult = await this.wrapWithLoading(next.asyncFunction, next.loadingText);
                        next.resolve(queueResult);
                    } catch (error) {
                        next.reject(error);
                    }
                }, 100);
            }
            
            return result;
        } catch (error) {
            console.error('❌ Loading error:', error);
            throw error;
        } finally {
            this.isLoading = false;
            
            if (window.overlayManager) {
                setTimeout(() => {
                    window.overlayManager.hideLoading();
                }, 300);
            }
        }
    }
}

// Initialize when DOM is ready
let overlayManager = null;
let loadingManager = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🎛️ Initializing Overlay Manager on DOMContentLoaded');
    overlayManager = new OverlayManager();
    loadingManager = new LoadingManager();
    
    // Make available globally
    window.overlayManager = overlayManager;
    window.loadingManager = loadingManager;
    
    // Enhanced bracket loading with better feedback
    window.loadSmartBracketWithLoading = async function() {
        return await loadingManager.wrapWithLoading(async () => {
            if (typeof loadSmartBracket === 'function') {
                return await loadSmartBracket();
            } else {
                throw new Error('loadSmartBracket function not available');
            }
        }, 'Lade Smart Bracket...');
    };
});

// Export classes
window.OverlayManager = OverlayManager;
window.LoadingManager = LoadingManager;