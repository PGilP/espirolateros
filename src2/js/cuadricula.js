const canvas = document.getElementById('cuadricula');
const ctx = canvas.getContext('2d');
const gridSize = 24;
const lineSet = new Set();

let paintedCells = new Set();
let paintedLines = [];

// === FUNCIONES BÁSICAS ===
function resizeCanvasSharp() {
    const dpr = window.devicePixelRatio || 1;

    const cssWidth  = window.innerWidth - 20;
    const cssHeight = window.innerHeight - 150;

    canvas.style.width  = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';

    canvas.width  = Math.floor(cssWidth  * dpr);
    canvas.height = Math.floor(cssHeight * dpr);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    startGrid();
}

function startGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawPatternLines() {
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1.5;
    paintedLines.forEach(({x1, y1, x2, y2}) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2,y2);
        ctx.stroke();
    });
}

function resetCanvas() {
    paintedCells.clear();
    paintedLines = [];
    lineSet.clear();
    resizeCanvasSharp();
}

function lineKey(x1, y1, x2, y2) {
    const r = v => Math.round(v * 1000); // precisión suficiente

    const a = [r(x1), r(y1)];
    const b = [r(x2), r(y2)];

    // Orden consistente
    const p1 = (a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1])) ? a : b;
    const p2 = (p1 === a) ? b : a;

    return `${p1[0]},${p1[1]}-${p2[0]},${p2[1]}`;
}

function exportToSVG() {
    
    if (!paintedLines.length) return;

    const svgLineSet = new Set();
    const lines = [];
    const PRECISION = 1000; // ajusta para la tolerancia

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    function q(v) { return Math.round(v * PRECISION); }

    for (const { x1, y1, x2, y2 } of paintedLines) {
        // cuantiza antes de generar la clave
        const key = (q(x1) < q(x2) || (q(x1) === q(x2) && q(y1) <= q(y2)))
            ? `${q(x1)},${q(y1)}-${q(x2)},${q(y2)}`
            : `${q(x2)},${q(y2)}-${q(x1)},${q(y1)}`;

        if (svgLineSet.has(key)) continue;

        svgLineSet.add(key);
        lines.push({ x1, y1, x2, y2 });

        minX = Math.min(minX, x1, x2);
        maxX = Math.max(maxX, x1, x2);
        minY = Math.min(minY, y1, y2);
        maxY = Math.max(maxY, y1, y2);
    }

    const width  = maxX - minX;
    const height = maxY - minY;

    let svg = `
<svg xmlns="http://www.w3.org/2000/svg"
     style="margin: 10px"
     viewBox="${minX} ${minY} ${width} ${height}"
     width="${width}"
     height="${height}">
<g fill="none" stroke="black" stroke-width="1.5">
`;

    for (const l of lines) {
        svg += `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" />\n`;
    }

    svg += `</g></svg>`;

    downloadSVG(svg, 'espirolatero.svg');
}

function downloadSVG(content, filename) {
    const blob = new Blob([content], { type: 'image/svg+xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// === EVENTOS ===
window.addEventListener('resize', resizeCanvasSharp);
document.getElementById('clean').addEventListener('click', resetCanvas);
document.getElementById('exportSVG').addEventListener('click', exportToSVG);

// === ARRAYS DE DIRECCIONES ===
const dirs45 = [
    {dx: 0, dy: 1},     // 90° abajo
    {dx: 1, dy: -1},    // 135° arriba-derecha
    {dx: -1, dy: 0},    // 180° izquierda
    {dx: 1, dy: 1},     // 225° abajo-derecha
    {dx: 0, dy: -1},    // 270° arriba
    {dx: -1, dy: 1},    // 315° abajo-izquierda
    {dx: 1, dy: 0},     // 0° derecha
    {dx: -1, dy: -1},   // 45° arriba-izquierda
];

const dirs60 = [
    {dx: 0, dy: 1},                      // 90° abajo
    {dx: Math.sqrt(3)/2, dy: -0.5},      // 150° arriba-derecha
    {dx: -1, dy: 0},                     // 180° izquierda
    {dx: Math.sqrt(3)/2, dy: 0.5},       // 210° abajo-derecha
    {dx: 0, dy: -1},                     // 270° arriba
    {dx: -Math.sqrt(3)/2, dy: 0.5},      // 330° abajo-izquierda
    {dx: 1, dy: 0},                      // 0° derecha extra
    {dx: -Math.sqrt(3)/2, dy: -0.5},     // 30° arriba-izquierda
];

// === FUNCIÓN DE DIRECCIÓN ===
function getDirection(grados, paso) {
    if (grados % 45 === 0) {
        const idx = Math.round((paso * (grados / 45)) % dirs45.length);
        return dirs45[idx];
    } 
    if (grados % 60 === 0) {
        const idx = Math.round((paso * (grados / 60)) % dirs60.length);
        return dirs60[idx];
    }
    const ang = Math.PI / 2 + paso * (grados * Math.PI / 180);
    return { dx: Math.cos(ang), dy: Math.sin(ang) };
}

// === EVENTO BOTÓN PATRÓN ===
document.getElementById('btnPatron').addEventListener('click', () => {
    resetCanvas();
    const SCALE = document.getElementById('inputEscala').value;
    const patronArr = document.getElementById('inputPatron').value
        .split(',')
        .map(n => parseInt(n.trim(), 10))
        .filter(n => !isNaN(n));

    const grados = parseInt(document.getElementById('inputGrados').value) || 90;

    let col = (canvas.width / 2) / gridSize;
    let row = (canvas.height / 2) / gridSize;

    paintedLines = [];
    let paso = 0;
    let estados = new Set();
    let outLimits = false;
    let repeticiones = 0;

    do {
        
        const estado = `${col},${row},${paso % (360 / grados)}`;
        if (estados.has(estado))break;
        estados.add(estado);

        for (let rep of patronArr) {
            const { dx, dy } = getDirection(grados, paso);
            for (let j = 0; j < rep; j++) {
                const x = col * gridSize;
                const y = row * gridSize;
                const x2 = (col + dx) * gridSize;
                const y2 = (row + dy) * gridSize;

                const key = lineKey(x, y, x2, y2);

                if (!lineSet.has(key)) {
                    paintedLines.push({ x1: x, y1: y, x2, y2 });
                    lineSet.add(key);
                }
                col += dx;
                row += dy;
            }
            paso++;
        }
        repeticiones++;
    }while (repeticiones < 20000)

        // ===== CENTRAR EL PATRÓN =====
    if (paintedLines.length > 0) {
        let minX = Math.min(...paintedLines.map(l => Math.min(l.x1, l.x2)));
        let maxX = Math.max(...paintedLines.map(l => Math.max(l.x1, l.x2)));
        let minY = Math.min(...paintedLines.map(l => Math.min(l.y1, l.y2)));
        let maxY = Math.max(...paintedLines.map(l => Math.max(l.y1, l.y2)));

        const offsetX = (canvas.width - (maxX - minX)) / 2 - minX;
        const offsetY = (canvas.height - (maxY - minY)) / 2 - minY;

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        paintedLines = paintedLines.map(l => {
            const x1 = l.x1 + offsetX;
            const y1 = l.y1 + offsetY;
            const x2 = l.x2 + offsetX;
            const y2 = l.y2 + offsetY;

            return {
                x1: cx + (x1 - cx) * SCALE,
                y1: cy + (y1 - cy) * SCALE,
                x2: cx + (x2 - cx) * SCALE,
                y2: cy + (y2 - cy) * SCALE
            };
        });
    }

    drawPatternLines();
});

// === INICIALIZACIÓN ===
resizeCanvasSharp();
startGrid()