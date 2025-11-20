// Fullscreen Interaction - KOMPLETT NEUE SIMPLE VERSION

class FullscreenInteraction {
    constructor() {
        this.container = null;
        this.viewport = null;
        this.content = null;

        // State
        this.isDragging = false;
        this.lastPos = { x: 0, y: 0 };
        this.position = { x: 0, y: 0 };
        this.zoom = 1;

        // Settings
        this.minZoom = 0.2;
        this.maxZoom = 3.0;
        this.zoomSpeed = 0.1;

        this.init();
    }

    init() {
        console.log('🎯 Starting SIMPLE fullscreen interaction...');

        this.container = document.getElementById('fullscreenContainer');
        this.viewport = document.getElementById('bracketViewport');
        this.content = document.getElementById('bracketContent');

        if (!this.container || !this.viewport || !this.content) {
            console.error('❌ Missing elements');
            return;
        }

        this.setupEvents();
        console.log('✅ Simple interaction ready');
    }

    setupEvents() {
        // Mouse drag
        this.container.addEventListener('mousedown', (e) => {
            if (e.target.closest('a, button, .smart-match-link, .team')) return;

            this.isDragging = true;
            this.lastPos = { x: e.clientX, y: e.clientY };
            this.container.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;

            const deltaX = e.clientX - this.lastPos.x;
            const deltaY = e.clientY - this.lastPos.y;

            this.position.x += deltaX;
            this.position.y += deltaY;

            this.lastPos = { x: e.clientX, y: e.clientY };

            this.applyConstraints();
            this.update();
        });

        document.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.container.style.cursor = 'grab';
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
                const zoomFactor = newZoom / this.zoom;
                this.position.x = mouseX - (mouseX - this.position.x) * zoomFactor;
                this.position.y = mouseY - (mouseY - this.position.y) * zoomFactor;
                this.zoom = newZoom;

                this.applyConstraints();
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
                case '0':
                    e.preventDefault();
                    this.reset();
                    break;
            }
        });
    }

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

            this.applyConstraints();
            this.update();
        }
    }

    applyConstraints() {
        const bracket = this.getBracket();
        if (!bracket) return;

        const containerRect = this.container.getBoundingClientRect();
        const bracketW = bracket.offsetWidth;
        const bracketH = bracket.offsetHeight;
        const scaledW = bracketW * this.zoom;
        const scaledH = bracketH * this.zoom;

        let minX, maxX, minY, maxY;

        if (scaledW <= containerRect.width) {
            // Bracket passt horizontal rein - zentrieren, aber kleine Pan-Toleranz lassen
            const centerX = (containerRect.width - scaledW) / 2;
            const tolerance = 50; // 50px Pan-Toleranz
            minX = centerX - tolerance;
            maxX = centerX + tolerance;
        } else {
            // Bracket breiter als Container - normale Constraints
            maxX = 0;
            minX = containerRect.width - scaledW;
        }

        // KRITISCHER FIX: Vertikale Constraints mit Padding-Berücksichtigung
        // Das Bracket hat jetzt 30px Padding oben und unten
        const verticalPadding = 30 * this.zoom; // Padding wird auch skaliert

        if (scaledH <= containerRect.height) {
            // Bracket passt vertikal rein - erlaube Pan bis zum Padding-Bereich
            minY = -verticalPadding;
            maxY = verticalPadding;
        } else {
            // Bracket höher als Container
            // Erlaube Pannen bis zum Padding oben (maxY) und unten (minY)
            maxY = verticalPadding;
            minY = containerRect.height - scaledH - verticalPadding;
        }

        this.position.x = Math.max(minX, Math.min(maxX, this.position.x));
        this.position.y = Math.max(minY, Math.min(maxY, this.position.y));
    }

    update() {
        // WICHTIG: Bei transform-origin 0 0 wird erst translate, dann scale angewendet
        // Das bedeutet die translate-Werte werden auch skaliert!
        // Um das zu vermeiden: translate-Werte durch zoom teilen
        const scaledX = this.position.x / this.zoom;
        const scaledY = this.position.y / this.zoom;

        this.viewport.style.transform = `scale(${this.zoom}) translate(${scaledX}px, ${scaledY}px)`;

        const display = document.getElementById('zoomLevel');
        if (display) {
            display.textContent = `${Math.round(this.zoom * 100)}%`;
        }

        // Debug: Zeige echte Pixel-Position
        const realX = scaledX * this.zoom;
        const realY = scaledY * this.zoom;
        console.log('🔄 Transform:', `scale(${this.zoom.toFixed(3)}) translate(${scaledX.toFixed(0)}px, ${scaledY.toFixed(0)}px)`);
        console.log('📍 Real position:', `X: ${realX.toFixed(0)}px, Y: ${realY.toFixed(0)}px`);
    }

    getBracket() {
        return this.content.querySelector('.smart-bracket');
    }

    reset() {
        const bracket = this.getBracket();
        if (!bracket) {
            setTimeout(() => this.reset(), 200);
            return;
        }

        const containerRect = this.container.getBoundingClientRect();
        const bracketW = bracket.offsetWidth;
        const bracketH = bracket.offsetHeight;

        console.log('📊 Reset Debug:', 'Container:', containerRect.width, 'x', containerRect.height, 'Bracket:', bracketW, 'x', bracketH);

        // Berechne Zoom um das ganze Bracket sichtbar zu machen
        const scaleX = (containerRect.width * 0.95) / bracketW;
        const scaleY = (containerRect.height * 0.95) / bracketH;
        this.zoom = Math.min(scaleX, scaleY, 1); // Max 100%, sonst kleiner

        // Nach Zoom neu berechnen
        const scaledW = bracketW * this.zoom;
        const scaledH = bracketH * this.zoom;

        // Horizontal zentrieren
        this.position.x = (containerRect.width - scaledW) / 2;

        // KRITISCHER FIX: Vertikal IMMER oben positionieren
        // Das Bracket hat Headers bei Y=0-40 und Matches ab Y=40
        // Wir wollen sicherstellen, dass der obere Rand (Y=0) am Container-Top ist
        if (scaledH <= containerRect.height) {
            // Bracket passt komplett rein - oben positionieren (Y=0)
            this.position.y = 0;
        } else {
            // Bracket größer als Container - oben starten
            this.position.y = 0;
        }

        console.log('📍 Position:', 'X:', this.position.x.toFixed(0), 'Y:', this.position.y.toFixed(0), 'Zoom:', Math.round(this.zoom * 100) + '%');

        this.update();
    }

    // Public API
    autoFitBracket() {
        // Nicht mehr verwendet - nur für Kompatibilität
        this.reset();
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
}

// Initialize
let fullscreenInteraction = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing fullscreen interaction');
    fullscreenInteraction = new FullscreenInteraction();
    window.fullscreenInteraction = fullscreenInteraction;
});

window.FullscreenInteraction = FullscreenInteraction;

// DEBUG FUNCTION
window.debugBracketPositions = function() {
    console.log('🔍 BRACKET POSITION DEBUG');
    console.log('='.repeat(60));

    // Check all container elements
    const viewport = document.getElementById('bracketViewport');
    const content = document.getElementById('bracketContent');
    const bracket = document.querySelector('.smart-bracket');

    if (viewport) {
        const rect = viewport.getBoundingClientRect();
        const transform = window.getComputedStyle(viewport).transform;
        console.log('📦 Bracket Viewport:');
        console.log(`   BoundingClientRect: Top=${rect.top}, Left=${rect.left}`);
        console.log(`   Transform: ${transform}`);
    }

    if (content) {
        const rect = content.getBoundingClientRect();
        const computed = window.getComputedStyle(content);
        console.log('\n📦 Bracket Content:');
        console.log(`   BoundingClientRect: Top=${rect.top}, Left=${rect.left}`);
        console.log(`   Position: ${computed.position}`);
        console.log(`   Top: ${computed.top}`);
        console.log(`   Left: ${computed.left}`);
        console.log(`   Transform: ${computed.transform}`);
    }

    // Check intermediate containers
    const bracketContainer = document.querySelector('.bracket-container');
    if (bracketContainer) {
        const rect = bracketContainer.getBoundingClientRect();
        const computed = window.getComputedStyle(bracketContainer);
        console.log('\n📦 Bracket Container (.bracket-container):');
        console.log(`   BoundingClientRect: Top=${rect.top}, Left=${rect.left}`);
        console.log(`   Position: ${computed.position}`);
        console.log(`   Display: ${computed.display}`);
        console.log(`   Vertical-align: ${computed.verticalAlign}`);
    }

    const bracketContentDiv = document.getElementById('bracketcontent');
    if (bracketContentDiv) {
        const rect = bracketContentDiv.getBoundingClientRect();
        const computed = window.getComputedStyle(bracketContentDiv);
        console.log('\n📦 Bracket Content DIV (#bracketcontent):');
        console.log(`   BoundingClientRect: Top=${rect.top}, Left=${rect.left}`);
        console.log(`   Position: ${computed.position}`);
        console.log(`   Display: ${computed.display}`);
        console.log(`   Vertical-align: ${computed.verticalAlign}`);
    }

    if (!bracket) {
        console.log('❌ No bracket found');
        return;
    }

    const bracketRect = bracket.getBoundingClientRect();
    const bracketComputed = window.getComputedStyle(bracket);
    console.log('\n📦 Smart Bracket:');
    console.log(`   BoundingClientRect: Top=${bracketRect.top}px, Left=${bracketRect.left}px`);
    console.log(`   Width: ${bracketRect.width}px`);
    console.log(`   Height: ${bracketRect.height}px`);
    console.log(`   Bottom: ${bracketRect.bottom}px`);
    console.log(`   Position: ${bracketComputed.position}`);
    console.log(`   Transform: ${bracketComputed.transform}`);

    const matches = bracket.querySelectorAll('.smart-match-absolute');
    console.log(`\n🎯 Found ${matches.length} matches`);

    // Finde min/max Y-Werte
    let minY = Infinity;
    let maxY = -Infinity;
    let minMatch = null;
    let maxMatch = null;

    matches.forEach(match => {
        const style = window.getComputedStyle(match);
        const top = parseFloat(style.top);

        if (top < minY) {
            minY = top;
            minMatch = match;
        }
        if (top > maxY) {
            maxY = top;
            maxMatch = match;
        }
    });

    console.log(`\n📊 Y-Position Range (in smart-bracket coordinates):`);
    console.log(`   Min Y: ${minY}px`);
    console.log(`   Max Y: ${maxY}px`);
    console.log(`   Total Y span: ${maxY - minY}px`);

    if (minMatch) {
        const rect = minMatch.getBoundingClientRect();
        console.log(`\n🔝 Top-most match (Y=${minY}px):`);
        console.log(`   BoundingClientRect.top: ${rect.top}px`);
        console.log(`   Visible: ${rect.top >= 0 && rect.top < window.innerHeight}`);
    }

    if (maxMatch) {
        const rect = maxMatch.getBoundingClientRect();
        console.log(`\n🔻 Bottom-most match (Y=${maxY}px):`);
        console.log(`   BoundingClientRect.top: ${rect.top}px`);
        console.log(`   Visible: ${rect.top >= 0 && rect.top < window.innerHeight}`);
    }

    // Check Round Headers
    const headers = bracket.querySelectorAll('.round-header');
    console.log(`\n📋 Found ${headers.length} round headers`);
    if (headers.length > 0) {
        const firstHeader = headers[0];
        const headerRect = firstHeader.getBoundingClientRect();
        console.log(`\n📋 First header:`);
        console.log(`   Text: "${firstHeader.textContent}"`);
        console.log(`   BoundingClientRect.top: ${headerRect.top}px`);
        console.log(`   Visible: ${headerRect.top >= 0 && headerRect.top < window.innerHeight}`);
    }

    console.log('\n' + '='.repeat(60));
};
