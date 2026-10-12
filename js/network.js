/**
 * network.js
 * ---------------------------------------------------------------------------
 * Cross-window messaging over a BroadcastChannel (no server involved).
 *
 * Message types
 *   HEARTBEAT        a window reports its geometry and velocity
 *   BALLS            a window reports the particles it currently simulates
 *   TRANSIT_OBJECT   a window hands ownership of one particle to a specific peer
 *   WINDOW_CLOSED    a window announces it is going away
 *
 * Every particle is simulated by exactly one window (its owner). Peers only receive
 * read-only copies, which they draw and use as neighbors.
 */

import { CHANNEL_NAME, KINDS } from './config.js';
import { balls } from './world.js';

/** The channel shared by all windows of this origin. */
export const channel = new BroadcastChannel(CHANNEL_NAME);

/** Random id that identifies this window to its peers. */
export const uniqueId = Math.random().toString(36).slice(2, 8);

/** Latest heartbeat of every peer window, keyed by window id. */
export const otherWindows = new Map();

/** Latest particle list of every peer window, keyed by window id. */
export const remoteBalls = new Map();

// ---------------------------------------------------------------------------
// Incoming messages
// ---------------------------------------------------------------------------
channel.onmessage = (event) => {
    const message = event.data;

    if (message.type === 'HEARTBEAT') {
        // A peer reported its geometry and velocity.
        otherWindows.set(message.id, message);
    } else if (message.type === 'BALLS') {
        // A peer reported the particles it simulates (used for drawing and as fluid/contact neighbors).
        remoteBalls.set(message.id, message.balls);
    } else if (message.type === 'TRANSIT_OBJECT') {
        // A peer handed one of its particles over: from now on this window simulates it.
        if (message.targetId === uniqueId) {
            const tb = message.ball;
            for (const [id, list] of remoteBalls.entries()) {
                remoteBalls.set(id, list.filter(b => b.id !== tb.id));
            }
            if (!balls.some(b => b.id === tb.id)) {
                const kind = tb.kind || 'ball';
                const def = KINDS[kind] || KINDS.ball;
                balls.push({
                    id: tb.id,
                    kind: kind,
                    x: tb.x,
                    y: tb.y,
                    vx: tb.vx,
                    vy: tb.vy,
                    oldX: tb.x,
                    oldY: tb.y,
                    radius: tb.radius || def.radius,
                    hasEntered: false,
                    removed: false
                });
            }
        }
    } else if (message.type === 'WINDOW_CLOSED') {
        otherWindows.delete(message.id);
        remoteBalls.delete(message.id);
    }
};

// Tell peers immediately when this window closes so they do not wait for a timeout.
window.addEventListener('beforeunload', () => {
    channel.postMessage({
        type: 'WINDOW_CLOSED',
        id: uniqueId
    });
});

// Forget peers that stopped sending heartbeats (crashed, minimized or closed without notice).
setInterval(() => {
    const now = Date.now();
    for (const [id, win] of otherWindows.entries()) {
        if (now - win.timestamp > 2000) {
            otherWindows.delete(id);
            remoteBalls.delete(id);
        }
    }
}, 1000);
