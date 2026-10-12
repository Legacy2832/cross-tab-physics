/**
 * physics/rigid-bodies.js
 * ---------------------------------------------------------------------------
 * Rigid spheres: integration and ball-to-ball contacts.
 */

import { GRAVITY, LOST_DISTANCE, KINDS, CELL_SIZE } from '../config.js';
import { grid, getCellKey } from '../spatial-grid.js';
import { getPortalTarget } from '../geometry.js';
import { solveBoundaries } from './boundaries.js';

/**
 * @typedef {object} Frame  per-frame values shared by the physics stages
 * @property {number} dt  frame time (s), clamped
 * @property {number} now  Date.now() of the frame
 * @property {number[]} localBox  this window's viewport box
 * @property {number} winVx  window velocity x (px/s)
 * @property {number} winVy  window velocity y (px/s)
 * @property {number} lowestBottom  lowest bottom edge among this and fresh peer windows
 */

/**
 * Advances every ball by one frame.
 * @param {object[]} localBallsList  balls owned by this window
 * @param {Frame} frame
 */
export function integrateBalls(localBallsList, frame) {
    const { dt, now, localBox, winVx, winVy, lowestBottom } = frame;

    // Integrate every ball: gravity, light air drag, then wall collisions.
    for (let i = 0; i < localBallsList.length; i++) {
        const b = localBallsList[i];

        // A ball resting on a solid floor is held at the floor's velocity instead of accumulating
        // gravity every frame, which removes resting jitter. A portal below means there is no floor.
        const portalBelow = getPortalTarget('bottom', b.x, b.y, localBox, now);
        const onFloor = !portalBelow && (b.y >= localBox[3] - b.radius - 0.2) && Math.abs(b.vy - winVy) < 2.0;

        if (!onFloor) {
            b.vy += GRAVITY * dt;
        } else {
            b.vy = winVy;
        }

        b.vx *= 0.998;
        b.vy *= 0.998;

        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // Resolve walls, floor and ceiling (portal edges stay open).
        solveBoundaries(b, localBox, now, winVx, winVy);

        // Discard balls that fell out of the world.
        if (b.y - b.radius > lowestBottom + LOST_DISTANCE) {
            b.removed = true;
        }
    }
}

/**
 * Resolves overlaps between balls (local-local and local-peer) and re-applies the walls.
 * Must run after the fluid step, which fills the spatial grid.
 * @param {object[]} localBallsList  balls owned by this window
 * @param {Frame} frame
 */
export function solveBallContacts(localBallsList, frame) {
    const { now, localBox, winVx, winVy } = frame;

    // Ball-ball contact solver. Several relaxation passes per frame keep resting piles stable.
    for (let iter = 0; iter < 4; iter++) {
        for (let i = 0; i < localBallsList.length; i++) {
            const a = localBallsList[i];
            if (a.removed) continue;

            const aCx = Math.floor(a.x / CELL_SIZE);
            const aCy = Math.floor(a.y / CELL_SIZE);

            for (let cx = aCx - 2; cx <= aCx + 2; cx++) {
                for (let cy = aCy - 2; cy <= aCy + 2; cy++) {
                    const cell = grid.get(getCellKey(cx, cy));
                    if (!cell) continue;

                    for (let j = 0; j < cell.length; j++) {
                        const b = cell[j];
                        if (b === a || b.removed || b.kind !== 'ball') continue;
                        if (!b.isRemote && b.id <= a.id) continue;

                        const dx = b.x - a.x;
                        const dy = b.y - a.y;
                        const dist = Math.hypot(dx, dy);
                        const rSum = a.radius + b.radius;

                        if (dist < rSum && dist > 0.001) {
                            let nx = dx / dist;
                            let ny = dy / dist;
                            const overlap = rSum - dist;

                            const portalA = getPortalTarget('bottom', a.x, a.y, localBox, now);
                            const portalB = getPortalTarget('bottom', b.x, b.y, localBox, now);
                            const aOnFloor = !portalA && (a.y >= localBox[3] - a.radius - 1.0);
                            const bOnFloor = !portalB && (b.y >= localBox[3] - b.radius - 1.0);

                            // Two balls resting on the floor are separated horizontally so stacks do not squeeze upward.
                            if (aOnFloor && bOnFloor) {
                                ny = 0;
                                nx = dx >= 0 ? 1 : -1;
                            }

                            // Both balls are ours: move both and exchange an equal impulse. For a peer-owned ball only
                            // our ball reacts; the peer applies the mirror image to its own ball.
                            if (!b.isRemote) {
                                a.x -= nx * (overlap * 0.5);
                                a.y -= ny * (overlap * 0.5);
                                b.x += nx * (overlap * 0.5);
                                b.y += ny * (overlap * 0.5);

                                const rv = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
                                if (rv > 70) {
                                    const impulse = ((1 + KINDS.ball.bounciness) * 0.5) * rv;
                                    a.vx -= impulse * nx;
                                    a.vy -= impulse * ny;
                                    b.vx += impulse * nx;
                                    b.vy += impulse * ny;
                                } else if (rv > 0) {
                                    const impulse = 0.5 * rv;
                                    a.vx -= impulse * nx;
                                    a.vy -= impulse * ny;
                                    b.vx += impulse * nx;
                                    b.vy += impulse * ny;
                                }
                                a.vx *= 0.98;
                                b.vx *= 0.98;
                            } else {
                                a.x -= nx * (overlap * 0.5);
                                a.y -= ny * (overlap * 0.5);

                                const rv = (a.vx - (b.vx || 0)) * nx + (a.vy - (b.vy || 0)) * ny;
                                if (rv > 70) {
                                    const impulse = ((1 + KINDS.ball.bounciness) * 0.5) * rv;
                                    a.vx -= impulse * nx;
                                    a.vy -= impulse * ny;
                                } else if (rv > 0) {
                                    const impulse = 0.5 * rv;
                                    a.vx -= impulse * nx;
                                    a.vy -= impulse * ny;
                                }
                                a.vx *= 0.98;
                            }
                        }
                    }
                }
            }
        }

        for (let i = 0; i < localBallsList.length; i++) {
            solveBoundaries(localBallsList[i], localBox, now, winVx, winVy);
        }
    }
}
