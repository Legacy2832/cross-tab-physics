/**
 * ui.js
 * ---------------------------------------------------------------------------
 * User interface: buttons, keyboard shortcut, click-and-hold pouring and the telemetry panel.
 */

import { balls, clearAll } from './world.js';
import { uniqueId, otherWindows, remoteBalls } from './network.js';
import { getWindowContentOrigin } from './geometry.js';
import { spawnBalls, spawnWaterCluster, spawnCompanionWindow } from './spawners.js';

// ---------------------------------------------------------------------------
// Buttons and telemetry panel
// ---------------------------------------------------------------------------
let hudVisible = true;
const readoutEl = document.getElementById('readout');
const toggleHudBtn = document.getElementById('toggleHudBtn');

/** Shows or hides the telemetry panel. */
function toggleHud() {
    hudVisible = !hudVisible;
    if (hudVisible) {
        readoutEl.classList.remove('hidden');
        toggleHudBtn.classList.remove('off');
    } else {
        readoutEl.classList.add('hidden');
        toggleHudBtn.classList.add('off');
    }
}

toggleHudBtn.addEventListener('click', toggleHud);

window.addEventListener('keydown', (e) => {
    if (e.key === 'h' || e.key === 'H' || e.key === 'd' || e.key === 'D') {
        toggleHud();
    }
});

document.getElementById('spawnBtn').addEventListener('click', spawnBalls);
document.getElementById('spawnWaterBtn').addEventListener('click', () => spawnWaterCluster(50));
document.getElementById('spawnWindowBtn').addEventListener('click', spawnCompanionWindow);
document.getElementById('clearBtn').addEventListener('click', () => { clearAll(); });

// ---------------------------------------------------------------------------
// Pouring water with the mouse
// ---------------------------------------------------------------------------
// Click & drag to pour water
let isMouseDown = false;
let lastMousePos = { x: 0, y: 0 };

window.addEventListener('mousedown', (e) => {
    if (e.target.closest('#controls')) return;
    isMouseDown = true;
    lastMousePos = { x: e.clientX, y: e.clientY };
    const origin = getWindowContentOrigin();
    spawnWaterCluster(12, origin.xMin + e.clientX, origin.yMin + e.clientY);
});

window.addEventListener('mousemove', (e) => {
    lastMousePos = { x: e.clientX, y: e.clientY };
});

window.addEventListener('mouseup', () => { isMouseDown = false; });

let mousePourTimer = 0;

/**
 * While the mouse button is held, pours a small burst of water at the cursor every 60 ms.
 * Call once per frame.
 * @param {number} dt  frame time (s)
 */
export function handleMousePour(dt) {
    if (isMouseDown) {
        mousePourTimer += dt;
        if (mousePourTimer > 0.06) {
            const origin = getWindowContentOrigin();
            spawnWaterCluster(6, origin.xMin + lastMousePos.x, origin.yMin + lastMousePos.y);
            mousePourTimer = 0;
        }
    }
}

let lastReadoutTime = 0;

/**
 * Refreshes the telemetry panel (at most every 100 ms).
 * @param {number} timestamp  requestAnimationFrame timestamp (ms)
 * @param {number} totalPhysicsMs  time spent in the physics stages of the last frame
 */
export function updateReadout(timestamp, totalPhysicsMs) {
    if (timestamp - lastReadoutTime > 100) {
        if (hudVisible) {
            let totalRemoteCount = 0;
            for (const list of remoteBalls.values()) totalRemoteCount += list.length;

            const localBalls = balls.filter(b => b.kind === 'ball').length;
            const localWater = balls.filter(b => b.kind === 'water').length;

            readoutEl.innerHTML =
                `<b>TELEMETRY</b> <span style="opacity:0.5;">(${uniqueId})</span>\n` +
                `Spheres:   <span class="val">${localBalls}</span>  |  Liquid: <span class="val">${localWater}</span>\n` +
                `Remote:    <span class="val">${totalRemoteCount}</span>\n` +
                `Physics:   <span class="val">${totalPhysicsMs.toFixed(2)} ms</span>\n` +
                `Windows:   <span class="val">${otherWindows.size + 1}</span>\n\n` +
                `<span style="opacity:0.6;">Slide an overlapping tab underneath to drop contents.</span>`;
        }
        lastReadoutTime = timestamp;
    }
}
