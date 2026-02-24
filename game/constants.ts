// Map dimensions
export const MAP_WIDTH = 100;
export const MAP_DEPTH = 300;

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
export const TREE_COUNT = 150;
export const TREE_MIN_RADIUS = 0.3;
export const TREE_MAX_RADIUS = 0.8;
export const TREE_MIN_HEIGHT = 3;
export const TREE_MAX_HEIGHT = 7;
export const TREE_SPACING = 2.5; // minimum distance between trees
export const CORRIDOR_WIDTH = 6; // clearance along center path

// Zones (z-axis positions)
export const START_Z = -(MAP_DEPTH / 2 - 20);
export const FINISH_Z = MAP_DEPTH / 2 - 10;

// Fog
export const FOG_DENSITY = 0.012;

// Gravity
export const GRAVITY = -2.8;
