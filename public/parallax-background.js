// Parallax Background für Swiss Cup Brackets
// Low-poly style Berg-Landschaft mit Parallax-Effekt

class ParallaxBackground {
    constructor() {
        this.container = null;
        this.layers = [];
        this.isInitialized = false;

        // Layer-Konfiguration (vom Hintergrund zum Vordergrund)
        // Subtilere Farben und weniger Opacity für elegantes Design
        this.layerConfig = [
            { depth: 0.05, color: '#222222', opacity: 0.4, name: 'far-mountains' },
            { depth: 0.12, color: '#252525', opacity: 0.35, name: 'mid-mountains' },
            { depth: 0.20, color: '#282828', opacity: 0.3, name: 'near-mountains' }
        ];
    }

    initialize() {
        console.log('🏔️ Initializing Parallax Background...');

        this.container = document.getElementById('fullscreenContainer');
        if (!this.container) {
            console.error('❌ Fullscreen container not found');
            return;
        }

        // Erstelle Background Container
        this.createBackgroundContainer();

        // Erstelle alle Layer
        this.createLayers();

        // Hook in die Fullscreen Interaction
        this.setupParallaxHook();

        this.isInitialized = true;
        console.log('✅ Parallax Background initialized with', this.layers.length, 'layers');
    }

    createBackgroundContainer() {
        // Entferne existierenden Background
        const existing = document.getElementById('parallaxBackground');
        if (existing) existing.remove();

        const bgContainer = document.createElement('div');
        bgContainer.id = 'parallaxBackground';
        bgContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            z-index: 0;
            pointer-events: none;
        `;

        this.container.insertBefore(bgContainer, this.container.firstChild);
        this.bgContainer = bgContainer;
    }

    createLayers() {
        this.layerConfig.forEach((config, index) => {
            const layer = this.createLayer(config, index);
            this.layers.push({
                element: layer,
                depth: config.depth,
                config: config
            });
            this.bgContainer.appendChild(layer);
        });
    }

    createLayer(config, index) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', `parallax-layer ${config.name}`);
        svg.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            opacity: ${config.opacity};
        `;

        // Generiere Low-Poly Berg-Formen
        const shapes = this.generateMountainShapes(config, index);
        shapes.forEach(shape => svg.appendChild(shape));

        return svg;
    }

    generateMountainShapes(config, layerIndex) {
        const shapes = [];
        const numPeaks = 2 + layerIndex; // Weniger Peaks für cleaner Look

        for (let i = 0; i < numPeaks; i++) {
            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');

            // Berg-Position und Größe - subtiler und weiter unten
            const baseX = (i / numPeaks) * 130 - 15; // Mehr Spread
            const peakHeight = 15 + (layerIndex * 8) + Math.random() * 12; // Kleiner
            const baseWidth = 20 + Math.random() * 30;

            // Low-poly Berg-Punkte (Prozent-basiert für responsive)
            const points = this.generateMountainPoints(baseX, peakHeight, baseWidth, layerIndex);

            polygon.setAttribute('points', points);
            polygon.setAttribute('fill', config.color);
            polygon.setAttribute('opacity', '1'); // Volle Opacity, aber Layer-Opacity kontrolliert

            shapes.push(polygon);
        }

        // TODO: Hügel später wieder aktivieren und verfeinern
        // for (let i = 0; i < numPeaks; i++) {
        //     const hill = this.generateHill(config.color, layerIndex);
        //     shapes.push(hill);
        // }

        return shapes;
    }

    generateMountainPoints(baseX, peakHeight, baseWidth, layerIndex) {
        const baseY = 100; // Unten
        const peakY = baseY - peakHeight;

        // Zufällige Peaks für Low-Poly Look
        const peakOffset = (Math.random() - 0.5) * (baseWidth * 0.3);
        const leftSlope = baseX + Math.random() * 5;
        const rightSlope = baseX + baseWidth - Math.random() * 5;

        // Mehrere Punkte für asymmetrische Berge
        const points = [
            `${baseX}%,${baseY}%`,
            `${leftSlope}%,${peakY + Math.random() * 10}%`,
            `${baseX + baseWidth * 0.4 + peakOffset}%,${peakY}%`,
            `${baseX + baseWidth * 0.6 + peakOffset}%,${peakY + Math.random() * 5}%`,
            `${rightSlope}%,${peakY + Math.random() * 10}%`,
            `${baseX + baseWidth}%,${baseY}%`
        ];

        return points.join(' ');
    }

    generateHill(color, layerIndex) {
        const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');

        const cx = Math.random() * 140 - 20; // Breitere Verteilung
        const cy = 90 + Math.random() * 15; // Weiter unten am Rand
        const rx = 8 + Math.random() * 15; // Kleiner
        const ry = 3 + Math.random() * 6; // Flacher

        ellipse.setAttribute('cx', `${cx}%`);
        ellipse.setAttribute('cy', `${cy}%`);
        ellipse.setAttribute('rx', `${rx}%`);
        ellipse.setAttribute('ry', `${ry}%`);
        ellipse.setAttribute('fill', color);
        ellipse.setAttribute('opacity', '0.5'); // Subtiler

        return ellipse;
    }

    setupParallaxHook() {
        // Hook in die Fullscreen Interaction update-Funktion
        const interaction = window.fullscreenInteraction;
        if (!interaction) {
            console.warn('⚠️ Fullscreen interaction not found, retrying...');
            setTimeout(() => this.setupParallaxHook(), 500);
            return;
        }

        // Speichere Original-Update
        const originalUpdate = interaction.update.bind(interaction);

        // Override mit Parallax-Update
        interaction.update = () => {
            originalUpdate();
            this.updateParallax(interaction.position, interaction.zoom);
        };

        console.log('🔗 Parallax hook installed');
    }

    updateParallax(position, zoom) {
        if (!this.isInitialized || this.layers.length === 0) return;

        // Berechne Parallax-Offset für jeden Layer basierend auf Depth
        this.layers.forEach(layer => {
            // Subtilerer Parallax-Effekt
            const parallaxX = position.x * layer.depth * 0.5;
            const parallaxY = position.y * layer.depth * 0.5;
            const parallaxZoom = 1 + ((zoom - 1) * layer.depth * 0.3);

            layer.element.style.transform = `translate(${parallaxX}px, ${parallaxY}px) scale(${parallaxZoom})`;
        });
    }

    destroy() {
        if (this.bgContainer) {
            this.bgContainer.remove();
        }
        this.layers = [];
        this.isInitialized = false;
        console.log('🗑️ Parallax Background destroyed');
    }

    // Debug: Zeige Layer-Informationen
    debug() {
        console.log('🔍 Parallax Background Debug:');
        console.log(`Initialized: ${this.isInitialized}`);
        console.log(`Layers: ${this.layers.length}`);
        this.layers.forEach((layer, i) => {
            console.log(`  Layer ${i}: depth=${layer.depth}, name=${layer.config.name}`);
        });
    }
}

// Global Instance
let parallaxBackgroundInstance = null;

// Initialisierung
function initializeParallaxBackground() {
    console.log('🏔️ Starting Parallax Background initialization...');

    if (!parallaxBackgroundInstance) {
        parallaxBackgroundInstance = new ParallaxBackground();
    }

    parallaxBackgroundInstance.initialize();
}

// Auto-Initialize nach DOM-Load
document.addEventListener('DOMContentLoaded', function() {
    // Warte bis Fullscreen Interaction bereit ist
    setTimeout(() => {
        initializeParallaxBackground();
    }, 100);
});

// Export
window.initializeParallaxBackground = initializeParallaxBackground;
window.ParallaxBackground = ParallaxBackground;
window.parallaxBackgroundInstance = parallaxBackgroundInstance;
