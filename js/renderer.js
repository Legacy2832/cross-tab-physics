/**
 * renderer.js
 * ---------------------------------------------------------------------------
 * Two stacked canvases.
 *
 *   waterCanvas  water particles; an SVG "goo" filter (see index.html) blurs and thresholds
 *                the layer so neighboring droplets merge into one liquid surface
 *   ballCanvas   rigid balls, drawn as shaded spheres on top
 *
 * Particles live in global screen coordinates; subtracting this window's (predicted) origin
 * turns them into canvas coordinates, so every window draws its own slice of the same world.
 */

import { balls } from './world.js';
import { remoteBalls } from './network.js';

const waterCanvas = document.getElementById('waterCanvas');
const waterCtx = waterCanvas.getContext('2d');

const ballCanvas = document.getElementById('ballCanvas');
const ballCtx = ballCanvas.getContext('2d', { desynchronized: true });

function resizeCanvases() {
    waterCanvas.width = window.innerWidth;
    waterCanvas.height = window.innerHeight;
    ballCanvas.width = window.innerWidth;
    ballCanvas.height = window.innerHeight;
}
resizeCanvases();
window.addEventListener('resize', resizeCanvases);

/**
 * Draws every particle (own and peers') for the current frame.
 * @param {{predictedScreenX:number, predictedScreenY:number, chromeX:number, chromeY:number}} view
 *   window origin used to convert global coordinates to canvas coordinates
 */
export function renderFrame(view) {
    const { predictedScreenX, predictedScreenY, chromeX, chromeY } = view;

    waterCtx.clearRect(0, 0, waterCanvas.width, waterCanvas.height);
    ballCtx.clearRect(0, 0, ballCanvas.width, ballCanvas.height);

    const renderedIds = new Set();

    // Draws one particle: water goes to the metaball layer, balls to the sprite layer. Particles
    // are de-duplicated by id because a handoff can briefly list the same particle twice.
    function drawParticle(b) {
        if (renderedIds.has(b.id)) return;
        renderedIds.add(b.id);

        const localX = b.x - (predictedScreenX + chromeX);
        const localY = b.y - (predictedScreenY + chromeY);

        if (b.kind === 'water') {
            const rad = b.radius + 3.2;
            const grad = waterCtx.createRadialGradient(
                localX, localY, 0,
                localX, localY, rad
            );
            grad.addColorStop(0, '#7dd3fc');
            grad.addColorStop(0.25, '#0284c7');
            grad.addColorStop(0.72, '#0369a1');
            grad.addColorStop(1, '#075985');

            waterCtx.beginPath();
            waterCtx.arc(localX, localY, rad, 0, Math.PI * 2);
            waterCtx.fillStyle = grad;
            waterCtx.fill();
        } else {
            ballCtx.save();

            ballCtx.beginPath();
            ballCtx.arc(localX + 1.2, localY + 2.2, b.radius * 0.95, 0, Math.PI * 2);
            ballCtx.fillStyle = 'rgba(0, 0, 0, 0.42)';
            ballCtx.fill();

            const grad = ballCtx.createRadialGradient(
                localX - b.radius * 0.32, localY - b.radius * 0.35, b.radius * 0.08,
                localX, localY, b.radius
            );
            grad.addColorStop(0, '#ff8a80');
            grad.addColorStop(0.25, '#dc2626');
            grad.addColorStop(0.7, '#8b151b');
            grad.addColorStop(0.92, '#450a0a');
            grad.addColorStop(1, '#6b1115');

            ballCtx.beginPath();
            ballCtx.arc(localX, localY, b.radius, 0, Math.PI * 2);
            ballCtx.fillStyle = grad;
            ballCtx.fill();

            ballCtx.beginPath();
            ballCtx.arc(localX - b.radius * 0.34, localY - b.radius * 0.36, b.radius * 0.18, 0, Math.PI * 2);
            ballCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ballCtx.fill();

            ballCtx.restore();
        }
    }

    for (let i = 0; i < balls.length; i++) drawParticle(balls[i]);
    for (const remoteList of remoteBalls.values()) {
        for (let i = 0; i < remoteList.length; i++) drawParticle(remoteList[i]);
    }
}
