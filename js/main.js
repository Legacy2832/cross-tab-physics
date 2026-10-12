/**
 * main.js
 * ---------------------------------------------------------------------------
 * Entry point: the per-frame simulation loop.
 *
 * Each frame this window
 *   1. samples its own position and velocity and broadcasts it,
 *   2. builds the list of fresh peer windows,
 *   3. simulates the particles it owns (balls, water, contacts) against the walls and portals,
 *   4. hands particles that left through a portal to the window behind it,
 *   5. broadcasts the particles it owns and draws everything it can see.
 *
 * Particles use global screen coordinates, so a particle visible in two overlapping windows
 * is drawn at the same physical spot in both.
 */

import { FRESH_MS } from './config.js';
import { balls, pruneRemoved } from './world.js';
import { channel, uniqueId, otherWindows } from './network.js';
import { getViewportBounds } from './geometry.js';
import { sampleWindow } from './window-tracker.js';
import { integrateBalls, solveBallContacts } from './physics/rigid-bodies.js';
import { simulateFluid } from './physics/fluid.js';
import { transferAcrossPortals } from './physics/handoff.js';
import { renderFrame } from './renderer.js';
import { handleMousePour, updateReadout } from './ui.js';

let lastTimestamp = null;
let totalPhysicsMs = 0;

/** One animation frame. */
function update(timestamp) {
    if (lastTimestamp === null) lastTimestamp = timestamp;
    let dt = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    // A long frame (tab was in the background, debugger pause) must not blow up the physics.
    dt = Math.min(dt, 1 / 30);

    handleMousePour(dt);

    const { winVx, winVy, predictedScreenX, predictedScreenY, chromeX, chromeY, localState } = sampleWindow(dt, timestamp);

    // This window's viewport box, and the lowest bottom edge among this and the fresh peer windows.
    const localBox = getViewportBounds(localState);
    const now = Date.now();
    let lowestBottom = localBox[3];

    for (const win of otherWindows.values()) {
        if (now - win.timestamp < FRESH_MS) {
            const b = getViewportBounds(win);
            if (b[3] > lowestBottom) lowestBottom = b[3];
        }
    }

    // Values shared by the physics stages.
    const frame = { dt, now, localBox, winVx, winVy, lowestBottom };

    // ---- Physics pipeline ----------------------------------------------------
    const physicsStartTime = performance.now();

    const localBallsList = [];
    const localWaterList = [];

    for (let i = 0; i < balls.length; i++) {
        const p = balls[i];
        if (p.removed) continue;
        if (p.kind === 'water') localWaterList.push(p);
        else localBallsList.push(p);
    }

    integrateBalls(localBallsList, frame);
    simulateFluid(localWaterList, localBallsList, frame);
    solveBallContacts(localBallsList, frame);
    transferAcrossPortals(frame);

    totalPhysicsMs = performance.now() - physicsStartTime;

    // Tell peers which particles this window simulates.
    channel.postMessage({
        type: 'BALLS',
        id: uniqueId,
        balls: balls.map(b => ({
            id: b.id,
            kind: b.kind,
            x: b.x,
            y: b.y,
            vx: b.vx,
            vy: b.vy,
            radius: b.radius
        }))
    });

    renderFrame({ predictedScreenX, predictedScreenY, chromeX, chromeY });

    // Remove particles that were handed over or lost, after they were drawn and broadcast once more.
    pruneRemoved();

    updateReadout(timestamp, totalPhysicsMs);

    requestAnimationFrame(update);
}

requestAnimationFrame(update);
