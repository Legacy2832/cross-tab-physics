/**
 * physics/handoff.js
 * ---------------------------------------------------------------------------
 * Ownership transfer of particles between windows.
 *
 * A particle that crosses an open portal edge is removed locally and sent to the window
 * behind it with its position and velocity, so motion continues seamlessly.
 */

import { MAX_BALL_SPEED } from '../config.js';
import { balls } from '../world.js';
import { channel } from '../network.js';
import { getPortalTarget } from '../geometry.js';

/**
 * @param {import('./rigid-bodies.js').Frame} frame
 */
export function transferAcrossPortals(frame) {
    const { now, localBox } = frame;

    // Apply the speed cap, then hand over any particle that left through an open portal edge.
    for (let i = 0; i < balls.length; i++) {
        const b = balls[i];
        if (b.removed) continue;

        const speed = Math.hypot(b.vx, b.vy);
        if (speed > MAX_BALL_SPEED) {
            const factor = MAX_BALL_SPEED / speed;
            b.vx *= factor;
            b.vy *= factor;
        }

        // Which side did the particle leave through, and is there a window behind that side?
        let targetWinId = null;

        if (b.y > localBox[3]) {
            targetWinId = getPortalTarget('bottom', b.x, b.y, localBox, now);
        } else if (b.y < localBox[1]) {
            targetWinId = getPortalTarget('top', b.x, b.y, localBox, now);
        } else if (b.x < localBox[0]) {
            targetWinId = getPortalTarget('left', b.x, b.y, localBox, now);
        } else if (b.x > localBox[2]) {
            targetWinId = getPortalTarget('right', b.x, b.y, localBox, now);
        }

        // Momentum is preserved: the peer continues the particle with the same velocity.
        if (targetWinId) {
            channel.postMessage({
                type: 'TRANSIT_OBJECT',
                targetId: targetWinId,
                ball: {
                    id: b.id,
                    kind: b.kind,
                    x: b.x,
                    y: b.y,
                    vx: b.vx,
                    vy: b.vy,
                    radius: b.radius
                }
            });
            b.removed = true;
        }
    }
}
