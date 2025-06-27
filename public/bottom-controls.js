// Bottom Controls Manager - Cup/Season Auswahl und Zoom Controls
// Integrierte JavaScript-basierte Cup/Season Auswahl ohne HTML Dropdowns

class BottomControlsManager {
    constructor() {
        this.container = null;
        this.cupButtons = null;
        this.seasonButtons = null;
        this.toggleButton = null;
        this.isCollapsed = false;
        
        // Cup/Season Data
        this.cups = [
            { id: 'herren_grossfeld', name: 'Herren Grossfeld', short: 'H-GF' },
            { id: 'damen_grossfeld', name: 'Damen Grossfeld', short: 'D-GF' },
            { id: 'herren_kleinfeld', name: 'Herren Kleinfeld', short: 'H-KF' },
            { id: 'damen_kleinfeld', name: 'Damen Kleinfeld', short: 'D-KF' }
        ];
        
        this.seasons = [
            '2024/25',
            '2023/24', 
            '2022/23',
            '2021/22'
        ];
        
        // Current Selection
        this.currentCup = 'herren_grossfeld';
        this.currentSeason = this.getCurrentSeason();
        
        this.init();
    }
    
    init() {
        console.log('🎛️ Initializing Bottom Controls Manager...');
        
        this.container = document.getElementById('bottomRightControls');
        this.cupButtons = document.getElementById('cupButtons');
        this.seasonButtons = document.getElementById('seasonButtons');
        this.toggleButton = document.getElementById('toggleBottomControls');
        
        if (!this.container || !this.cupButtons || !this.seasonButtons) {
            console.error('❌ Bottom controls elements not found');
            return;
        }
        
        this.setupEventListeners();
        this.renderCupButtons();
        this.renderSeasonButtons();
        
        // KORRIGIERT: Keine automatische Ladung hier, da smartbracket.js bereits lädt
        console.log('✅ Bottom Controls Manager initialized');
    }
    
    getCurrentSeason() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        
        if (month >= 5) {
            return `${year}/${String(year + 1).slice(-2)}`;
        } else {
            return `${year - 1}/${String(year).slice(-2)}`;
        }
    }
    
    setupEventListeners() {
        // Toggle Button
        if (this.toggleButton) {
            this.toggleButton.addEventListener('click', this.toggleControls.bind(this));
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeydown.bind(this));
    }
    
    renderCupButtons() {
        if (!this.cupButtons) return;
        
        // Create dropdown select instead of buttons
        const selectHTML = `
            <select id="cupDropdown" class="cup-dropdown">
                ${this.cups.map(cup => 
                    `<option value="${cup.id}" ${cup.id === this.currentCup ? 'selected' : ''}>${cup.name}</option>`
                ).join('')}
            </select>
        `;
        
        this.cupButtons.innerHTML = selectHTML;
        
        // Add event listener to dropdown
        const dropdown = this.cupButtons.querySelector('#cupDropdown');
        if (dropdown) {
            dropdown.addEventListener('change', (e) => {
                this.selectCup(e.target.value);
            });
        }
        
        console.log(`✅ Rendered cup dropdown with ${this.cups.length} options`);
    }
    
    renderSeasonButtons() {
        if (!this.seasonButtons) return;
        
        // Create dropdown select instead of buttons
        const selectHTML = `
            <select id="seasonDropdown" class="season-dropdown">
                ${this.seasons.map(season => 
                    `<option value="${season}" ${season === this.currentSeason ? 'selected' : ''}>${season}</option>`
                ).join('')}
            </select>
        `;
        
        this.seasonButtons.innerHTML = selectHTML;
        
        // Add event listener to dropdown
        const dropdown = this.seasonButtons.querySelector('#seasonDropdown');
        if (dropdown) {
            dropdown.addEventListener('change', (e) => {
                this.selectSeason(e.target.value);
            });
        }
        
        console.log(`✅ Rendered season dropdown with ${this.seasons.length} options`);
    }
    
    selectCup(cupId) {
        if (this.currentCup === cupId) return;
        
        this.currentCup = cupId;
        
        // Update dropdown selection
        const dropdown = this.cupButtons.querySelector('#cupDropdown');
        if (dropdown) {
            dropdown.value = cupId;
        }
        
        console.log(`🏒 Selected cup: ${cupId}`);
        this.loadCurrentBracket();
    }
    
    selectSeason(season) {
        if (this.currentSeason === season) return;
        
        this.currentSeason = season;
        
        // Update dropdown selection
        const dropdown = this.seasonButtons.querySelector('#seasonDropdown');
        if (dropdown) {
            dropdown.value = season;
        }
        
        console.log(`📅 Selected season: ${season}`);
        this.loadCurrentBracket();
    }
    
    async loadCurrentBracket() {
        console.log(`🔄 Loading bracket: ${this.currentCup} - ${this.currentSeason}`);
        
        // Set loading state
        const cupSection = document.getElementById('cupSelection');
        if (cupSection) {
            cupSection.classList.add('loading');
        }
        
        try {
            // Update the original dropdowns for compatibility
            this.updateOriginalDropdowns();
            
            // Call the original load function
            if (typeof window.loadSmartBracket === 'function') {
                await window.loadSmartBracket();
            } else {
                console.error('❌ loadSmartBracket function not available');
            }
        } catch (error) {
            console.error('❌ Error loading bracket:', error);
        } finally {
            // Remove loading state
            setTimeout(() => {
                if (cupSection) {
                    cupSection.classList.remove('loading');
                }
                // Auto-fit nach dem Laden - NEU!
                if (window.fullscreenInteraction && typeof window.fullscreenInteraction.autoFitBracket === 'function') {
                    setTimeout(() => {
                        window.fullscreenInteraction.autoFitBracket();
                    }, 200);
                }
            }, 500);
        }
    }
    
    updateOriginalDropdowns() {
        // Update the hidden dropdowns for compatibility with existing code
        const cupSelect = document.getElementById('cupselect');
        const seasonSelect = document.getElementById('seasonselect');
        
        if (cupSelect) {
            cupSelect.value = this.currentCup;
        }
        
        if (seasonSelect) {
            seasonSelect.value = this.currentSeason;
        }
    }
    
    toggleControls() {
        this.isCollapsed = !this.isCollapsed;
        
        if (this.isCollapsed) {
            this.container.classList.add('collapsed');
        } else {
            this.container.classList.remove('collapsed');
        }
        
        console.log(`🎛️ Bottom controls ${this.isCollapsed ? 'collapsed' : 'expanded'}`);
    }
    
    showControls() {
        if (this.isCollapsed) {
            this.toggleControls();
        }
    }
    
    hideControls() {
        if (!this.isCollapsed) {
            this.toggleControls();
        }
    }
    
    handleKeydown(e) {
        // Don't interfere if typing in inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
            return;
        }
        
        switch (e.key) {
            case 'c':
            case 'C':
                if (!e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    this.toggleControls();
                }
                break;
            case '1':
                e.preventDefault();
                this.selectCup('herren_grossfeld');
                break;
            case '2':
                e.preventDefault();
                this.selectCup('damen_grossfeld');
                break;
            case '3':
                e.preventDefault();
                this.selectCup('herren_kleinfeld');
                break;
            case '4':
                e.preventDefault();
                this.selectCup('damen_kleinfeld');
                break;
        }
    }
    
    // Public API
    getCurrentCup() {
        return this.currentCup;
    }
    
    getCurrentSeason() {
        return this.currentSeason;
    }
    
    setCup(cupId) {
        if (this.cups.find(c => c.id === cupId)) {
            this.selectCup(cupId);
        }
    }
    
    setSeason(season) {
        if (this.seasons.includes(season)) {
            this.selectSeason(season);
        }
    }
    
    refreshBracket() {
        this.loadCurrentBracket();
    }
    
    addCustomCup(id, name, short) {
        this.cups.push({ id, name, short });
        this.renderCupButtons();
    }
    
    addCustomSeason(season) {
        if (!this.seasons.includes(season)) {
            this.seasons.unshift(season);
            this.renderSeasonButtons();
        }
    }
}

// Enhanced Zoom Controls Integration
class ZoomControlsIntegration {
    constructor(fullscreenInteraction) {
        this.interaction = fullscreenInteraction;
        this.setupZoomButtons();
    }
    
    setupZoomButtons() {
        const zoomIn = document.getElementById('zoomIn');
        const zoomOut = document.getElementById('zoomOut');
        const zoomReset = document.getElementById('zoomReset');
        
        if (zoomIn && this.interaction) {
            zoomIn.addEventListener('click', () => {
                this.interaction.zoomIn();
            });
        }
        
        if (zoomOut && this.interaction) {
            zoomOut.addEventListener('click', () => {
                this.interaction.zoomOut();
            });
        }
        
        if (zoomReset && this.interaction) {
            zoomReset.addEventListener('click', () => {
                this.interaction.resetView();
            });
        }
    }
}

// Initialize when DOM is ready
let bottomControlsManager = null;
let zoomControlsIntegration = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🎛️ Initializing Bottom Controls Manager on DOMContentLoaded');
    
    bottomControlsManager = new BottomControlsManager();
    
    // Wait for fullscreen interaction to be ready
    setTimeout(() => {
        if (window.fullscreenInteraction) {
            zoomControlsIntegration = new ZoomControlsIntegration(window.fullscreenInteraction);
        }
    }, 100);
    
    // Make available globally
    window.bottomControlsManager = bottomControlsManager;
});

// Export classes
window.BottomControlsManager = BottomControlsManager;
window.ZoomControlsIntegration = ZoomControlsIntegration;