export interface FloatingText {
  id: number;
  x: number;
  y: number;
  value: number;
}

export interface GameState {
  score: number;
  energy: number;
}

export interface UserData {
  username: string;
  score: number;
  energy: number;
  lastUpdated: number;
  lastRewardTime: number;
}