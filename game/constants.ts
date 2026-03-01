// Map dimensions
export const MAP_WIDTH = 60;
export const MAP_DEPTH = 500;

// Player
export const PLAYER_SPEED = 0.45;
export const PLAYER_RADIUS = 0.5;
export const PLAYER_HEIGHT = 1.8;

// Monster
export const MONSTER_SPEED = 0.38;
export const MONSTER_DETECT_RANGE = 40;
export const CATCH_RADIUS = 2.0;
export const RECATCH_GRACE_MS = 2000;

// Chat / argument loop
export const CHAT_ROUNDS = 3;
export const CHAT_ROUND_SECONDS = 12;
export const CHAT_WIN_THRESHOLD = 7;

// Camera
export const CAMERA_DISTANCE = 10;
export const CAMERA_FOV = 0.8;
export const CAMERA_Y_TILT = 0.35;
export const MOUSE_SENSITIVITY = 0.0024;
export const CAMERA_PITCH_MIN = -0.6;
export const CAMERA_PITCH_MAX = 0.75;
export const LOOKSPRING_STRENGTH = 0.045;

// Forest
export const TREE_COUNT = 350;
export const TREE_MIN_RADIUS = 0.3;
export const TREE_MAX_RADIUS = 0.8;
export const TREE_MIN_HEIGHT = 3;
export const TREE_MAX_HEIGHT = 7;
export const TREE_SPACING = 2.5; // minimum distance between trees
export const CORRIDOR_WIDTH = 5; // clearance along center path
export const CORRIDOR_AMPLITUDE = 6; // sinusoidal path swing

// Zones (z-axis positions)
export const START_Z = -(MAP_DEPTH / 2 - 20);
export const FINISH_Z = MAP_DEPTH / 2 - 10;

// Fog
export const FOG_DENSITY = 0.015;

// Gravity
export const GRAVITY = -2.8;

// Phase 3 — Textures
export const TEXTURE_SIZE = 64;

// Phase 3 — Lighting
export const HEMI_INTENSITY = 1.0;
export const SHADOW_MAP_SIZE = 1024;
export const FLICKER_LIGHT_COUNT = 10;
export const FLICKER_LIGHT_RANGE = 18;
export const THUNDER_INTERVAL_MIN_MS = 5000;
export const THUNDER_INTERVAL_MAX_MS = 15000;
export const THUNDER_FLASH_DURATION_MS = 150;

// Phase 3 — Post-processing
export const GRAIN_INTENSITY = 25;
export const VIGNETTE_WEIGHT = 3.5;

// Phase 3 — Camera feel
export const HEAD_BOB_FREQUENCY = 8.0;
export const HEAD_BOB_AMPLITUDE = 0.06;
export const CATCH_SHAKE_INTENSITY = 0.3;
export const CATCH_SHAKE_DURATION_MS = 500;

// Phase 3 — Forest
export const FALLEN_LOG_COUNT = 18;
export const ROCK_COUNT = 60;

// Phase 3 — Audio
export const HEARTBEAT_MAX_INTERVAL = 2.0;
export const HEARTBEAT_MIN_INTERVAL = 0.4;
export const HEARTBEAT_MAX_DISTANCE = 40;
export const FOOTSTEP_INTERVAL = 0.35;
export const AMBIENT_VOLUME = 0.08;

// Phase 5 — Bots
export const BOT_COUNT = 3;
export const BOT_SPEED = 0.35;         // slightly slower than PLAYER_SPEED (0.45)
export const BOT_LATERAL_DRIFT = 0.3;  // max sinusoidal lateral wander per tick
export const BOT_FILL_TO_MAX = true;   // fill to MAX_PLAYERS on game start
