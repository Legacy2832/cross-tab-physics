/**
 * physics/boundaries.js
 * ---------------------------------------------------------------------------
 * Collision of a single particle with the walls of this window.
 *
 * A wall is only solid when no portal is open on that edge (see geometry.getPortalTarget).
 * Wall velocity (the window's own motion) is taken into account, so dragging a window
 * pushes particles.
 */

import { KINDS, REST_SPEED } from '../config.js';
import { getPortalTarget } from '../geometry.js';

/**
 * Keeps a particle inside this window's viewport, bouncing or sliding it off solid walls.
 * @param {object} b  particle (mutated in place)
 * @param {number[]} localBox  viewport box [xMin, yMin, xMax, yMax]
 * @param {number} now  Date.now() of the current frame
 * @param {number} winVx  window velocity x (px/s)
 * @param {number} winVy  window velocity y (px/s)
 */
export function solveBoundaries(b, localBox, now, winVx, winVy) {
    const r = b.radius;
    const [lxMin, lyMin, lxMax, lyMax] = localBox;

    // Free-fall phase: a particle that was just spawned above the window, or handed over by a
    // peer, ignores the walls until its center is inside this viewport.
    if (!b.hasEntered) {
        if (b.x >= lxMin && b.x <= lxMax && b.y >= lyMin && b.y <= lyMax) {
            b.hasEntered = true;
        }
        return;
    }

    // 1. Floor. Water slides freely along it (free-slip); balls lose some horizontal speed.
    if (b.y + r >= lyMax) {
        const targetWinId = getPortalTarget('bottom', b.x, b.y, localBox, now);
        if (!targetWinId) {
            b.y = lyMax - r;
            const relVy = b.vy - winVy;
            if (relVy > 0) {
                if (b.kind === 'water') {
                    b.vy = winVy;
                    b.vx = (b.vx - winVx) * 0.99 + winVx; // Fluid slides along floor freely
                } else {
                    if (relVy < REST_SPEED) {
                        b.vy = winVy;
                        b.vx = (b.vx - winVx) * 0.85 + winVx;
                        if (Math.abs(b.vx - winVx) < 1.0) b.vx = winVx;
                    } else {
                        b.vy = winVy - relVy * KINDS.ball.bounciness;
                        b.vx = (b.vx - winVx) * 0.95 + winVx;
                    }
                }
            }
        }
    }

    // 2. Ceiling.
    if (b.y - r <= lyMin) {
        const targetWinId = getPortalTarget('top', b.x, b.y, localBox, now);
        if (!targetWinId) {
            b.y = lyMin + r;
            const relVy = b.vy - winVy;
            if (relVy < 0) {
                if (b.kind === 'water') {
                    b.vy = winVy;
                } else {
                    b.vy = winVy - relVy * KINDS.ball.bounciness;
                }
            }
        }
    }

    // 3. Left wall.
    if (b.x - r <= lxMin) {
        const targetWinId = getPortalTarget('left', b.x, b.y, localBox, now);
        if (!targetWinId) {
            b.x = lxMin + r;
            const relVx = b.vx - winVx;
            if (relVx < 0) {
                if (b.kind === 'water') {
                    b.vx = winVx;
                } else {
                    if (Math.abs(relVx) < REST_SPEED) {
                        b.vx = winVx;
                    } else {
                        b.vx = winVx - relVx * KINDS.ball.bounciness;
                    }
                }
            }
        }
    }

    // 4. Right wall.
    if (b.x + r >= lxMax) {
        const targetWinId = getPortalTarget('right', b.x, b.y, localBox, now);
        if (!targetWinId) {
            b.x = lxMax - r;
            const relVx = b.vx - winVx;
            if (relVx > 0) {
                if (b.kind === 'water') {
                    b.vx = winVx;
                } else {
                    if (relVx < REST_SPEED) {
                        b.vx = winVx;
                    } else {
                        b.vx = winVx - relVx * KINDS.ball.bounciness;
                    }
                }
            }
        }
    }
}
