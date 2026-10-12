# Cross-Tab Physics

A browser sandbox where balls and liquid water live in screen space instead of inside a single page. Open several windows, arrange them so they touch or overlap, and whatever you spawn flows from one window into the next. Everything runs in the browser. There is no server and no build step.

**Github Pages:** https://legacy2832.github.io/cross-tab-physics/

## Quick start

1. Open the page.
2. Click **+ New Window** to open a second window of the app.
3. Arrange the windows so that one touches or overlaps an edge of the other, for example stacked vertically with a small overlap.
4. Click **Spawn Balls** or **Pour Water**. Objects drop in from above the window and pass into the neighbor through the touching or overlapping edge.

| Control | Action |
| --- | --- |
| Spawn Balls | Drops four rigid balls from above the window |
| Pour Water | Drops a stream of 50 water particles |
| Click and hold in the window | Pours water at the cursor |
| Drag a window | Moves its walls, so it can push, scoop and fling the contents |
| `H` or `D`, or the HUD button | Shows or hides the telemetry panel |
| Clear | Removes everything the current window is simulating |

## How it works

**Shared screen space.** Every window reads its position (`screenX`, `screenY`) and size, and subtracts the browser chrome (title bar, tabs, borders) to find where its page area sits on the desktop. Particles are stored in those global pixel coordinates. A window draws a particle at its global position minus its own origin, so two overlapping windows show the same particle at the same physical spot.

**Ownership and messaging.** Windows talk over a [`BroadcastChannel`](https://developer.mozilla.org/docs/Web/API/BroadcastChannel). Each particle is simulated by exactly one window, its owner. Peers receive read-only copies, which they draw and use as neighbors. The messages are `HEARTBEAT` (geometry and velocity of a window), `BALLS` (the particles a window owns), `TRANSIT_OBJECT` (hand a particle to a specific peer) and `WINDOW_CLOSED`.

**Portals.** An edge of a window is open when a recently active peer touches or overlaps it and shares more than 10 px of that edge. A particle that leaves through an open edge is removed locally and sent to the peer with the same position and velocity, so the motion continues unbroken. Edges without a neighbor are solid walls, and the wall's own velocity is added to the collision, which is why dragging a window pushes the contents.

**Water.** Water uses a position-based fluid method, double density relaxation (Clavet, Beaudoin and Poulin, 2005), with XSPH viscosity and a spatial hash grid for neighbor lookups. Water in a peer window takes part as a read-only neighbor, so liquid behaves consistently across a seam. A few caps on pressure, viscosity and speed keep the simulation stable under extreme compression.

**Rendering.** Two stacked canvases: one for water and one for balls. An SVG filter blurs and thresholds the water layer so neighboring droplets merge into a single surface.

## Run locally

The code uses ES modules, which browsers refuse to load from `file://`. Serve the folder over HTTP instead:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

The VS Code **Live Server** extension works as well. Open the served address in more than one window, or use the **+ New Window** button. All windows must share the same origin (same host and port), because that is how a `BroadcastChannel` finds its peers.

## Configuration

Everything tunable lives in [`js/config.js`](js/config.js). The values most worth adjusting:

| Constant | Effect |
| --- | --- |
| `GRAVITY` | Downward acceleration (px/s²) |
| `KINDS.ball.bounciness` | Bounce of balls off walls |
| `PROXIMITY_THRESHOLD` | Largest gap that still opens a portal (0 = windows must touch or overlap) |
| `H_RADIUS`, `REST_DENSITY`, `K_STIFFNESS`, `K_NEAR_STIFFNESS` | Fluid behavior |
| `VISCOSITY` | How strongly neighboring water particles share velocity |
| `MAX_WATER_SPEED` | Water speed cap; raise toward 2000 if falling water looks too slow |
| `LEAD_FRAMES` | How far ahead the window position is extrapolated when drawing |

## Known limitations

- **Water timing.** The fluid advances by a fixed 1/60 s per frame regardless of the real frame time, so on displays faster than 60 Hz water moves faster than balls.
- **Seams.** Water pairs split across two windows receive half of the pressure push that pairs inside one window receive, so water compresses slightly more at a seam.
- **Display scaling.** The canvases do not compensate for `devicePixelRatio`. Windows on monitors with different scaling may look soft or offset.
- **Covered windows.** Browsers may pause animation in a window that is completely hidden behind another one, which freezes the particles it owns.
- **Window coordinates.** The browser chrome offset is estimated from the difference between outer and inner window sizes, so edges can be a few pixels off. The project was developed in Chromium-based browsers; other browsers report window positions slightly differently and have not been tested.
- **Same origin only.** Windows can only see each other when they are served from the same origin.

## Credits

Fluid method: Simon Clavet, Philippe Beaudoin and Pierre Poulin, *Particle-based Viscoelastic Fluid Simulation*, Symposium on Computer Animation, 2005.
