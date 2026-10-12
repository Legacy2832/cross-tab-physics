/**
 * spawners.js
 * ---------------------------------------------------------------------------
 * Functions that create particles and companion windows.
 */

import { KINDS } from './config.js';
import { balls } from './world.js';
import { uniqueId } from './network.js';
import { getWindowContentOrigin } from './geometry.js';

/** Counter that makes particle ids unique within this window. */
let ballCounter = 0;

/** Drops a few rigid balls from above this window. */
export function spawnBalls() {
    const origin = getWindowContentOrigin();
    const BALL_COUNT = 4;
    const padding = KINDS.ball.radius + 20;
    const usableWidth = Math.max(0, window.innerWidth - padding * 2);

    // Spawn above the top edge of this window, staggered so balls do not overlap; gravity
    // then drops them in.
    for (let i = 0; i < BALL_COUNT; i++) {
        const spawnX = origin.xMin + padding + Math.random() * usableWidth;
        const spawnY = origin.yMin - KINDS.ball.radius - 20 - i * 55;

        balls.push({
            id: `${uniqueId}_${++ballCounter}`,
            kind: 'ball',
            x: spawnX,
            y: spawnY,
            vx: (Math.random() - 0.5) * 50,
            vy: 30 + Math.random() * 30,
            oldX: spawnX,
            oldY: spawnY,
            radius: KINDS.ball.radius,
            hasEntered: false,
            removed: false
        });
    }
}

/**
 * Creates a cluster of water particles.
 * @param {number} [count=50]  number of particles
 * @param {number|null} [customX=null]  global x of the stream center (default: random position above the window)
 * @param {number|null} [customY=null]  global y of the first particle (default: above the window)
 */
export function spawnWaterCluster(count = 50, customX = null, customY = null) {
    const origin = getWindowContentOrigin();
    const streamWidth = 40;
    const padding = KINDS.water.radius + 15;
    const usableWidth = Math.max(0, window.innerWidth - padding * 2 - streamWidth);
    const startX = customX !== null ? customX : (origin.xMin + padding + Math.random() * usableWidth);

    // A narrow vertical stream above the window (or above the cursor when coordinates are given).
    for (let i = 0; i < count; i++) {
        const spawnX = startX + (Math.random() - 0.5) * streamWidth;
        const spawnY = customY !== null 
            ? customY - i * 8 - Math.random() * 4 
            : origin.yMin - KINDS.water.radius - 15 - i * 8 - Math.random() * 4;

        balls.push({
            id: `${uniqueId}_${++ballCounter}`,
            kind: 'water',
            x: spawnX,
            y: spawnY,
            vx: (Math.random() - 0.5) * 6,
            vy: 110 + Math.random() * 30,
            oldX: spawnX,
            oldY: spawnY,
            radius: KINDS.water.radius,
            hasEntered: false,
            removed: false
        });
    }
}

/** Opens another window of the app, placed so it overlaps the bottom of this one. */
export function spawnCompanionWindow() {
    const w = Math.max(500, window.innerWidth);
    const h = Math.max(450, window.innerHeight);
    const left = window.screenX + 30;
    const top = window.screenY + window.outerHeight - 20; // overlapping slightly below
    window.open(window.location.href, '_blank', `width=${w},height=${h},left=${left},top=${top}`);
}
