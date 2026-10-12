/**
 * config.js
 * ---------------------------------------------------------------------------
 * Every tunable constant of the simulation in one place.
 *
 * Units: positions are screen pixels, speeds are px/s, accelerations are px/s^2 and
 * times are seconds unless a name ends in _MS.
 */

/** Name of the BroadcastChannel shared by every window of the app (same origin only). */
export const CHANNEL_NAME = 'sync_screen_windows';

/**
 * Physical definition of each particle kind.
 *   radius      collision radius (px)
 *   bounciness  restitution used when bouncing off walls
 *   mass        relative mass (informational; rigid-body impulses currently assume equal masses)
 *   invMass     1 / mass
 */
export const KINDS = {
    ball: {
        radius: 17,
        bounciness: 0.65,
        mass: 289,
        invMass: 1 / 289
    },
    water: {
        radius: 5.5,
        bounciness: 0.0,
        mass: 36,
        invMass: 1 / 36
    }
};

// ---------------------------------------------------------------------------
// Rigid bodies, walls and portals
// ---------------------------------------------------------------------------
/** Downward acceleration (px/s^2). */
export const GRAVITY = 1400;
/** Below this speed relative to a wall (px/s) a ball settles instead of bouncing. */
export const REST_SPEED = 80;
/** Largest gap (px) that still opens a portal between two windows. 0 means they must touch or overlap. */
export const PROXIMITY_THRESHOLD = 0;
/** Peer windows whose last heartbeat is older than this (ms) are ignored. */
export const FRESH_MS = 600;
/** Particles that fall this far (px) below the lowest window are discarded. */
export const LOST_DISTANCE = 800;
/** Hard speed cap applied to every particle (px/s). */
export const MAX_BALL_SPEED = 3500;

// ---------------------------------------------------------------------------
// Fluid (position-based, "double density relaxation" after Clavet et al. 2005)
// ---------------------------------------------------------------------------
/** Interaction radius (px): neighbors closer than this exert pressure on each other. */
export const H_RADIUS = 20;
/** Spatial-grid cell size (px). Kept equal to H_RADIUS so a 3x3 cell lookup finds every fluid neighbor. */
export const CELL_SIZE = 20;
/** Target density. Pressure is proportional to (density - REST_DENSITY). */
export const REST_DENSITY = 3.0;
/** Pressure stiffness. */
export const K_STIFFNESS = 1000;
/** Near-pressure stiffness; stops particles from collapsing onto each other. */
export const K_NEAR_STIFFNESS = 2000;
/** XSPH viscosity coefficient (the effective strength is additionally capped by MAX_VISC_STRENGTH). */
export const VISCOSITY = 0.18;
/** Fixed time step used for each fluid sub-step (s). */
export const FLUID_DT = 1 / 60;

// Stabilizers. They only act in extreme squeezes; ordinary water never reaches them.
/** Viscosity may blend at most this fraction of the neighbor-average velocity per step. Values above 1 diverge. */
export const MAX_VISC_STRENGTH = 0.5;
/** Maximum pressure push (px) between one pair of particles per step. */
export const MAX_PAIR_PUSH = 1.5;
/** Maximum total pressure push (px) on one particle per step. */
export const MAX_TOTAL_PUSH = 4;
/** Water speed cap (px/s). Raise it toward 2000 if falling water looks too slow. */
export const MAX_WATER_SPEED = 1200;

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
/** Frames of look-ahead used when drawing: the window position is extrapolated to hide the lag between the reported position and what is on screen. */
export const LEAD_FRAMES = 2.2;
