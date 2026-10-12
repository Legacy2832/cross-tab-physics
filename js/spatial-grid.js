/**
 * spatial-grid.js
 * ---------------------------------------------------------------------------
 * Uniform spatial hash grid over global screen coordinates.
 *
 * Particles are bucketed into square cells of CELL_SIZE pixels so neighbor searches only
 * visit nearby cells instead of every particle. Because all windows share the same global
 * coordinates, one grid covers local and peer particles alike. It is cleared and refilled
 * every fluid sub-step; cell arrays are recycled through a pool to avoid garbage-collection
 * stutter.
 */

import { CELL_SIZE } from './config.js';

/** Map from packed cell key to the array of particles in that cell. */
export const grid = new Map();
/** Recycled cell arrays. */
const cellPool = [];

export function getCellKey(cx, cy) {
    return (((cx + 32768) & 0xffff) << 16) | ((cy + 32768) & 0xffff);
}

export function clearGrid() {
    for (const arr of grid.values()) {
        arr.length = 0;
        cellPool.push(arr);
    }
    grid.clear();
}

export function insertIntoGrid(particle) {
    const cx = Math.floor(particle.x / CELL_SIZE);
    const cy = Math.floor(particle.y / CELL_SIZE);
    const key = getCellKey(cx, cy);

    let cell = grid.get(key);
    if (!cell) {
        cell = cellPool.length > 0 ? cellPool.pop() : [];
        grid.set(key, cell);
    }
    cell.push(particle);
}
