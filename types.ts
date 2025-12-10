export interface FloatingText {
  id: number;
  x: number;
  y: number;
  value: number; // The score number shown (+1, +10)
  type: 'score' | 'bonus';
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  angle: number; // Direction of flight
  velocity: number;
  life: number; // Opacity/Time to live
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