/**
 * physics/fluid.js
 * ---------------------------------------------------------------------------
 * Water simulation for every water particle owned by this window.
 */

import { GRAVITY, LOST_DISTANCE, H_RADIUS, CELL_SIZE, REST_DENSITY, K_STIFFNESS, K_NEAR_STIFFNESS,
         VISCOSITY, FLUID_DT, MAX_VISC_STRENGTH, MAX_PAIR_PUSH, MAX_TOTAL_PUSH, MAX_WATER_SPEED } from '../config.js';
import { clearGrid, insertIntoGrid, getCellKey, grid } from '../spatial-grid.js';
import { balls } from '../world.js';
import { remoteBalls } from '../network.js';
import { solveBoundaries } from './boundaries.js';

/**
 * Runs the water simulation for one frame.
 * @param {object[]} localWaterList  water particles owned by this window
 * @param {object[]} localBallsList  rigid balls owned by this window (water is pushed out of them)
 * @param {import('./rigid-bodies.js').Frame} frame
 */
export function simulateFluid(localWaterList, localBallsList, frame) {
    const { dt, now, localBox, winVx, winVy, lowestBottom } = frame;

    // Position-based fluid: double density relaxation (Clavet, Beaudoin & Poulin, 2005).
    // A slow frame runs two fixed sub-steps instead of one longer, less stable step.
    const fluidSteps = dt > 0.024 ? 2 : 1;
    const subDt = FLUID_DT;

    for (let step = 0; step < fluidSteps; step++) {
        // (a) Apply gravity and predict new positions; remember the old ones.
        for (let i = 0; i < localWaterList.length; i++) {
            const p = localWaterList[i];
            if (p.removed) continue;

            p.vy += GRAVITY * subDt;
            p.oldX = p.x;
            p.oldY = p.y;
            p.x += p.vx * subDt;
            p.y += p.vy * subDt;

            solveBoundaries(p, localBox, now, winVx, winVy);

            if (p.y - p.radius > lowestBottom + LOST_DISTANCE) {
                p.removed = true;
            }
        }

        // (b) Rebuild the spatial grid with local water, local balls and read-only peer particles.
        clearGrid();
        // Ids of particles we own. A peer may still list a particle it just handed to us; skip those.
        const localIds = new Set(balls.map(b => b.id));

        for (let i = 0; i < localWaterList.length; i++) {
            const p = localWaterList[i];
            if (!p.removed) {
                p.isRemote = false;
                insertIntoGrid(p);
            }
        }
        for (let i = 0; i < localBallsList.length; i++) {
            const p = localBallsList[i];
            if (!p.removed) {
                p.isRemote = false;
                insertIntoGrid(p);
            }
        }
        // Peer particles take part as read-only neighbors.
        for (const remoteList of remoteBalls.values()) {
            for (let i = 0; i < remoteList.length; i++) {
                const rp = remoteList[i];
                if (!localIds.has(rp.id)) {
                    rp.isRemote = true;
                    insertIntoGrid(rp);
                }
            }
        }

        // (c) Double density relaxation: push neighbors apart in proportion to local crowding.
        for (let i = 0; i < localWaterList.length; i++) {
            const p = localWaterList[i];
            if (p.removed || !p.hasEntered) continue;

            const pCx = Math.floor(p.x / CELL_SIZE);
            const pCy = Math.floor(p.y / CELL_SIZE);

            let rho = 0;
            let rhoNear = 0;

            for (let cx = pCx - 1; cx <= pCx + 1; cx++) {
                for (let cy = pCy - 1; cy <= pCy + 1; cy++) {
                    const cell = grid.get(getCellKey(cx, cy));
                    if (!cell) continue;

                    for (let j = 0; j < cell.length; j++) {
                        const other = cell[j];
                        if (other === p || other.kind !== 'water') continue;

                        const dx = other.x - p.x;
                        const dy = other.y - p.y;
                        const dist = Math.hypot(dx, dy);

                        if (dist < H_RADIUS) {
                            const q = 1 - dist / H_RADIUS;
                            rho += q * q;
                            rhoNear += q * q * q;
                        }
                    }
                }
            }

            // Pressure from density excess; near-pressure prevents stacking.
            const P = K_STIFFNESS * (rho - REST_DENSITY);
            const P_near = K_NEAR_STIFFNESS * rhoNear;

            let dx_p = 0;
            let dy_p = 0;

            for (let cx = pCx - 1; cx <= pCx + 1; cx++) {
                for (let cy = pCy - 1; cy <= pCy + 1; cy++) {
                    const cell = grid.get(getCellKey(cx, cy));
                    if (!cell) continue;

                    for (let j = 0; j < cell.length; j++) {
                        const other = cell[j];
                        if (other === p || other.kind !== 'water') continue;

                        const dx = other.x - p.x;
                        const dy = other.y - p.y;
                        const dist = Math.hypot(dx, dy);

                        if (dist < H_RADIUS && dist > 0.001) {
                            const q = 1 - dist / H_RADIUS;
                            const nx = dx / dist;
                            const ny = dy / dist;

                            // Displacement along the line between the two particles, capped so a heavy squeeze
                            // cannot fling them.
                            let D = (subDt * subDt) * (P * q + P_near * q * q);
                            if (D > MAX_PAIR_PUSH) D = MAX_PAIR_PUSH;
                            else if (D < -MAX_PAIR_PUSH) D = -MAX_PAIR_PUSH;

                            // Only move particles we own; the peer window moves its own.
                            if (!other.isRemote) {
                                other.x += nx * (D * 0.5);
                                other.y += ny * (D * 0.5);
                            }

                            dx_p -= nx * (D * 0.5);
                            dy_p -= ny * (D * 0.5);
                        }
                    }
                }
            }

            // Cap the total push on this particle for the same reason.
            const pushLen = Math.hypot(dx_p, dy_p);
            if (pushLen > MAX_TOTAL_PUSH) {
                const s = MAX_TOTAL_PUSH / pushLen;
                dx_p *= s;
                dy_p *= s;
            }
            p.x += dx_p;
            p.y += dy_p;
        }

        // (d) Resolve walls, push water out of rigid balls, then derive velocity from displacement.
        for (let i = 0; i < localWaterList.length; i++) {
            const p = localWaterList[i];
            if (p.removed || !p.hasEntered) continue;

            solveBoundaries(p, localBox, now, winVx, winVy);

            const pCx = Math.floor(p.x / CELL_SIZE);
            const pCy = Math.floor(p.y / CELL_SIZE);

            // Push water out of any rigid ball it overlaps.
            for (let cx = pCx - 2; cx <= pCx + 2; cx++) {
                for (let cy = pCy - 2; cy <= pCy + 2; cy++) {
                    const cell = grid.get(getCellKey(cx, cy));
                    if (!cell) continue;

                    for (let j = 0; j < cell.length; j++) {
                        const b = cell[j];
                        if (b.kind !== 'ball') continue;

                        const dx = p.x - b.x;
                        const dy = p.y - b.y;
                        const dist = Math.hypot(dx, dy);
                        const minDist = b.radius + p.radius;

                        if (dist < minDist && dist > 0.001) {
                            const overlap = minDist - dist;
                            const nx = dx / dist;
                            const ny = dy / dist;

                            p.x += nx * overlap;
                            p.y += ny * overlap;

                            if (!b.isRemote) {
                                b.vx *= 0.985;
                                b.vy *= 0.985;
                            }
                        }
                    }
                }
            }

            solveBoundaries(p, localBox, now, winVx, winVy);

            // Velocity follows from the net displacement of this step.
            p.vx = (p.x - p.oldX) / subDt;
            p.vy = (p.y - p.oldY) / subDt;

            // Speed cap: faster water would skip past neighbors and walls instead of interacting.
            const waterSpeed = Math.hypot(p.vx, p.vy);
            if (waterSpeed > MAX_WATER_SPEED) {
                const k = MAX_WATER_SPEED / waterSpeed;
                p.vx *= k;
                p.vy *= k;
            }
        }

        // (e) XSPH viscosity: blend each velocity toward its neighbors' average.
        for (let i = 0; i < localWaterList.length; i++) {
            const p = localWaterList[i];
            if (p.removed || !p.hasEntered) continue;

            const pCx = Math.floor(p.x / CELL_SIZE);
            const pCy = Math.floor(p.y / CELL_SIZE);

            let vDiffX = 0;
            let vDiffY = 0;
            let wSum = 0;

            for (let cx = pCx - 1; cx <= pCx + 1; cx++) {
                for (let cy = pCy - 1; cy <= pCy + 1; cy++) {
                    const cell = grid.get(getCellKey(cx, cy));
                    if (!cell) continue;

                    for (let j = 0; j < cell.length; j++) {
                        const other = cell[j];
                        if (other === p || other.kind !== 'water') continue;

                        const dx = other.x - p.x;
                        const dy = other.y - p.y;
                        const dist = Math.hypot(dx, dy);

                        if (dist < H_RADIUS) {
                            const q = 1 - dist / H_RADIUS;
                            wSum += q;
                            vDiffX += q * ((other.vx || 0) - p.vx);
                            vDiffY += q * ((other.vy || 0) - p.vy);
                        }
                    }
                }
            }

            // The blend strength grows with neighbor count, so it is capped; uncapped it diverges in dense clumps.
            const viscK = wSum > 0 ? Math.min(VISCOSITY * wSum, MAX_VISC_STRENGTH) / wSum : 0;
            p.vx += viscK * vDiffX;
            p.vy += viscK * vDiffY;
        }
    }
}
