/**
 * window-tracker.js
 * ---------------------------------------------------------------------------
 * Reads this window's position and size, estimates its velocity and broadcasts it.
 *
 * Browsers expose the window position (screenX/screenY) but not its velocity, so the
 * velocity is derived from consecutive frames and lightly smoothed. The data is sent to
 * peers as a HEARTBEAT message.
 */

import { LEAD_FRAMES } from './config.js';
import { channel, uniqueId } from './network.js';

let lastScreenX = window.screenX;
let lastScreenY = window.screenY;
let smoothVelX = 0;
let smoothVelY = 0;
let lastBroadcastTime = 0;
let wasMoving = false;

/**
 * Samples the window once per frame.
 * @param {number} dt  frame time (s)
 * @param {number} timestamp  requestAnimationFrame timestamp (ms)
 * @returns {{winVx:number, winVy:number, predictedScreenX:number, predictedScreenY:number,
 *            chromeX:number, chromeY:number, localState:object}}
 *   winVx/winVy       window velocity (px/s)
 *   predictedScreenX/Y  extrapolated window origin for drawing
 *   chromeX/chromeY   offset of the page area inside the window (title bar, borders)
 *   localState        the data broadcast to peers
 */
export function sampleWindow(dt, timestamp) {
    const rawScreenX = window.screenX;
    const rawScreenY = window.screenY;

    let instantVelX = rawScreenX - lastScreenX;
    let instantVelY = rawScreenY - lastScreenY;
    lastScreenX = rawScreenX;
    lastScreenY = rawScreenY;

    // Ignore sub-pixel jitter.
    if (Math.abs(instantVelX) <= 1) instantVelX = 0;
    if (Math.abs(instantVelY) <= 1) instantVelY = 0;

    // Exponential smoothing of the per-frame window displacement.
    smoothVelX = smoothVelX * 0.4 + instantVelX * 0.6;
    smoothVelY = smoothVelY * 0.4 + instantVelY * 0.6;

    if (Math.abs(smoothVelX) < 0.2) smoothVelX = 0;
    if (Math.abs(smoothVelY) < 0.2) smoothVelY = 0;

    // Prefer the instantaneous reading when it is larger, so quick flicks register immediately.
    const activeVelX = Math.abs(instantVelX) > Math.abs(smoothVelX) ? instantVelX : smoothVelX;
    const activeVelY = Math.abs(instantVelY) > Math.abs(smoothVelY) ? instantVelY : smoothVelY;
    const winVx = dt > 0 ? activeVelX / dt : 0;
    const winVy = dt > 0 ? activeVelY / dt : 0;

    // Extrapolated position, used only for drawing (see LEAD_FRAMES).
    const predictedScreenX = rawScreenX + (smoothVelX * LEAD_FRAMES);
    const predictedScreenY = rawScreenY + (smoothVelY * LEAD_FRAMES);

    const chromeY = Math.max(0, window.outerHeight - window.innerHeight);
    const chromeX = Math.max(0, (window.outerWidth - window.innerWidth) / 2);

    const localState = {
        id: uniqueId,
        screenX: rawScreenX,
        screenY: rawScreenY,
        chromeX: chromeX,
        chromeY: chromeY,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        vx: winVx,
        vy: winVy,
        timestamp: Date.now()
    };

    // Heartbeat: while moving, once more after stopping (so peers see zero velocity), and at
    // least every 100 ms otherwise.
    const hasMoved = Math.abs(instantVelX) > 0 || Math.abs(instantVelY) > 0;
    if (hasMoved || wasMoving || timestamp - lastBroadcastTime > 100) {
        channel.postMessage({
            type: 'HEARTBEAT',
            ...localState
        });
        lastBroadcastTime = timestamp;
    }
    wasMoving = hasMoved;

    return { winVx, winVy, predictedScreenX, predictedScreenY, chromeX, chromeY, localState };
}
