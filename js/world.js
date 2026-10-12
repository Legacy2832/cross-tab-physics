/**
 * world.js
 * ---------------------------------------------------------------------------
 * Shared simulation state: the particles owned (simulated) by THIS window.
 *
 * The array is exported as a constant and only ever mutated in place, so every module
 * that imports it always sees the same, current list.
 */

/**
 * Particles simulated by this window. Each entry:
 * { id, kind, x, y, vx, vy, oldX, oldY, radius, hasEntered, removed, isRemote }
 * Positions are global screen coordinates.
 */
export const balls = [];

/** Drops every particle flagged `removed` (handed to a peer, lost, ...), preserving order. */
export function pruneRemoved() {
    let kept = 0;
    for (let i = 0; i < balls.length; i++) {
        const b = balls[i];
        if (!b.removed) balls[kept++] = b;
    }
    balls.length = kept;
}

/** Removes every particle owned by this window. */
export function clearAll() {
    balls.length = 0;
}
