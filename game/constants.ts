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

// Camera
export const CAMERA_DISTANCE = 12;
export const CAMERA_FOV = 0.8;
export const CAMERA_Y_TILT = 0.45;

// Forest
export const TREE_COUNT = 150;
export const TREE_MIN_RADIUS = 0.3;
export const TREE_MAX_RADIUS = 0.8;
export const TREE_MIN_HEIGHT = 3;
export const TREE_MAX_HEIGHT = 7;
export const TREE_SPACING = 2.5; // minimum distance between trees
export const CORRIDOR_WIDTH = 4; // clearance along center path

// Zones (z-axis positions)
export const START_Z = -(MAP_DEPTH / 2 - 10);
export const FINISH_Z = MAP_DEPTH / 2 - 10;

// Fog
export const FOG_DENSITY = 0.02;

// Gravity
export const GRAVITY = -2.8;
