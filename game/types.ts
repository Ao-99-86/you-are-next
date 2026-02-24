export enum GamePhase {
  LOADING = "loading",
  PLAYING = "playing",
  ARGUMENT = "argument",
  GAME_OVER = "game_over",
}

export enum GameResult {
  WIN = "win",
  EATEN = "eaten",
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
