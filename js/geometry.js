/**
 * geometry.js
 * ---------------------------------------------------------------------------
 * Window geometry in global screen coordinates and portal detection.
 *
 * A window "viewport" is the page area (without browser chrome) expressed as a box
 * [xMin, yMin, xMax, yMax] in screen pixels, so boxes from different windows can be
 * compared directly.
 */

import { FRESH_MS, PROXIMITY_THRESHOLD } from './config.js';
import { otherWindows } from './network.js';

/**
 * Viewport box of a window from its heartbeat data.
 * @param {{screenX:number, screenY:number, chromeX:number, chromeY:number, innerWidth:number, innerHeight:number}} win
 * @returns {number[]} [xMin, yMin, xMax, yMax]
 */
export function getViewportBounds(win) {
    const xMin = win.screenX + win.chromeX;
    const yMin = win.screenY + win.chromeY;
    const xMax = xMin + win.innerWidth;
    const yMax = yMin + win.innerHeight;
    return [xMin, yMin, xMax, yMax];
}

/**
 * Tells whether one side of this window is an open portal at a given point.
 * @param {'bottom'|'top'|'left'|'right'} side   which edge of this window is being tested
 * @param {number} x  particle position (global px)
 * @param {number} y  particle position (global px)
 * @param {number[]} localBox  this window's viewport box
 * @param {number} now  Date.now() of the current frame
 * @returns {string|null} id of the peer window behind the portal, or null when the edge is a solid wall
 */
export function getPortalTarget(side, x, y, localBox, now) {
    const [lxMin, lyMin, lxMax, lyMax] = localBox;
    const localHeight = lyMax - lyMin;
    const localWidth = lxMax - lxMin;

    // A side is open when a fresh peer window overlaps this one by more than 10 px along that
    // edge and touches or overlaps it (see PROXIMITY_THRESHOLD).
    for (const win of otherWindows.values()) {
        if (now - win.timestamp >= FRESH_MS) continue;
        const rBox = getViewportBounds(win);
        const [rxMin, ryMin, rxMax, ryMax] = rBox;

        if (side === 'bottom') {
            const xOverlapMin = Math.max(lxMin, rxMin);
            const xOverlapMax = Math.min(lxMax, rxMax);
            if (xOverlapMax - xOverlapMin > 10 && x >= xOverlapMin && x <= xOverlapMax) {
                const gapY = ryMin - lyMax;
                // Touching or overlapping below
                if (gapY >= -localHeight && gapY <= PROXIMITY_THRESHOLD) {
                    return win.id;
                }
            }
        } else if (side === 'top') {
            const xOverlapMin = Math.max(lxMin, rxMin);
            const xOverlapMax = Math.min(lxMax, rxMax);
            if (xOverlapMax - xOverlapMin > 10 && x >= xOverlapMin && x <= xOverlapMax) {
                const gapY = lyMin - ryMax;
                if (gapY >= -localHeight && gapY <= PROXIMITY_THRESHOLD) {
                    return win.id;
                }
            }
        } else if (side === 'left') {
            const yOverlapMin = Math.max(lyMin, ryMin);
            const yOverlapMax = Math.min(lyMax, ryMax);
            if (yOverlapMax - yOverlapMin > 10 && y >= yOverlapMin && y <= yOverlapMax) {
                const gapX = lxMin - rxMax;
                if (gapX >= -localWidth && gapX <= PROXIMITY_THRESHOLD) {
                    return win.id;
                }
            }
        } else if (side === 'right') {
            const yOverlapMin = Math.max(lyMin, ryMin);
            const yOverlapMax = Math.min(lyMax, ryMax);
            if (yOverlapMax - yOverlapMin > 10 && y >= yOverlapMin && y <= yOverlapMax) {
                const gapX = rxMin - lxMax;
                if (gapX >= -localWidth && gapX <= PROXIMITY_THRESHOLD) {
                    return win.id;
                }
            }
        }
    }
    return null;
}

/**
 * Top-left corner of this window's page area in global screen coordinates.
 * @returns {{xMin:number, yMin:number}}
 */
export function getWindowContentOrigin() {
    const chromeY = Math.max(0, window.outerHeight - window.innerHeight);
    const chromeX = Math.max(0, (window.outerWidth - window.innerWidth) / 2);
    return {
        xMin: window.screenX + chromeX,
        yMin: window.screenY + chromeY
    };
}
