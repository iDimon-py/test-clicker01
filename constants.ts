export const MAX_ENERGY = 1000;
export const ENERGY_REGEN_RATE_MS = 3000; // Default 3 seconds
export const ENERGY_REGEN_AMOUNT = 1;
export const ENERGY_COST_PER_CLICK = 1;
export const CLICK_VALUE = 1;

// SERVER SYNC CONFIGURATION
// 10000 = 10 seconds. 
// Increase this (e.g. 60000) to lower server load.
// Decrease this (e.g. 5000) for more frequent saves (higher load).
export const SYNC_INTERVAL_MS = 5000; 

// Hourly Reward Constants
export const REWARD_COOLDOWN_MS = 3600000; // 1 hour in ms
export const REWARD_MIN = 50;
export const REWARD_MAX = 500;

export interface SkinConfig {
  id: number;
  name: string;
  cost: number;
  clickMultiplier: number;
  maxEnergy: number;
  regenRateSec: number; // Seconds per 1 energy
  iconPath: string; // SVG Path data
  colors: {
    ring: string;
    gradientFrom: string;
    gradientTo: string;
    glow: string;
    border: string;
  };
}

export const SKINS: SkinConfig[] = [
  {
    id: 0,
    name: "Cosmic Spider",
    cost: 0,
    clickMultiplier: 1,
    maxEnergy: 1000,
    regenRateSec: 3,
    iconPath: "M12 7a2 2 0 1 0-.001-4.001A2 2 0 0 0 12 7zm0 0v3m-5-3c-1.5 1-2 3-2 5m12-5c1.5 1 2 3 2 5m-9-3c-1 1-1 3-1 4m8-4c1 1 1 3 1 4M7 13c-2 0-4 1-5 3m15-3c2 0 4 1 5 3M8 15c-1 2-1 4-2 5m10-5c1 2 1 4 2 5m-6-5a4 4 0 1 1 0 8 4 4 0 0 1 0-8z",
    colors: {
      ring: 'border-slate-800/80',
      gradientFrom: 'from-cyan-500',
      gradientTo: 'to-purple-700',
      glow: 'bg-blue-600/30',
      border: 'border-cyan-500/30'
    }
  },
  {
    id: 1,
    name: "Emerald Snake",
    cost: 5000,
    clickMultiplier: 2,
    maxEnergy: 2000,
    regenRateSec: 3,
    iconPath: "M10 20.5c0 .6.4 1 1 1h4c.6 0 1-.4 1-1v-2c0-.6-.4-1-1-1h-4c-.6 0-1 .4-1 1v2zm-3-5c0 .6.4 1 1 1h8c.6 0 1-.4 1-1v-2c0-.6-.4-1-1-1H8c-.6 0-1 .4-1 1v2zm-2-5c0 .6.4 1 1 1h12c.6 0 1-.4 1-1V8.5c0-.6-.4-1-1-1H6c-.6 0-1 .4-1 1v2zM12 2a3 3 0 0 0-3 3v.5c0 .6.4 1 1 1h4c.6 0 1-.4 1-1V5a3 3 0 0 0-3-3z",
    colors: {
      ring: 'border-green-900/80',
      gradientFrom: 'from-emerald-500',
      gradientTo: 'to-teal-800',
      glow: 'bg-emerald-600/30',
      border: 'border-emerald-500/30'
    }
  },
  {
    id: 2,
    name: "Plasma Scorpion",
    cost: 10000,
    clickMultiplier: 5,
    maxEnergy: 5000,
    regenRateSec: 2,
    iconPath: "M17 3c0 2-2 3-2 5 0 2 2 4 2 6 .1 2.3-1.6 4-4 4H9c-2.3 0-4-1.8-4-4 0-2 2-4 2-6 0-2-2-3-2-5M8 11h8M8 15h8M5 6l2 2m12-2l-2 2M12 18v4",
    colors: {
      ring: 'border-fuchsia-900/80',
      gradientFrom: 'from-fuchsia-500',
      gradientTo: 'to-purple-900',
      glow: 'bg-fuchsia-600/30',
      border: 'border-fuchsia-500/30'
    }
  },
  {
    id: 3,
    name: "Solar Lion",
    cost: 20000,
    clickMultiplier: 10,
    maxEnergy: 10000,
    regenRateSec: 2,
    iconPath: "M12 2c-4 0-8 3-8 8 0 3 2 6 5 7l-2 3h10l-2-3c3-1 5-4 5-7 0-5-4-8-8-8zm0 13c-2.5 0-4.5-2-4.5-4.5S9.5 6 12 6s4.5 2 4.5 4.5S14.5 15 12 15zm-2-6a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm4 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2z",
    colors: {
      ring: 'border-red-900/80',
      gradientFrom: 'from-orange-500',
      gradientTo: 'to-red-900',
      glow: 'bg-orange-600/30',
      border: 'border-orange-500/30'
    }
  },
  {
    id: 4,
    name: "Singularity Dragon",
    cost: 50000,
    clickMultiplier: 25,
    maxEnergy: 20000,
    regenRateSec: 1,
    iconPath: "M19 12c.6 0 1 .4 1 1v4c0 1.1-.9 2-2 2s-2-.9-2-2v-2c0-.6.4-1 1-1h2zm-8-3c.6 0 1 .4 1 1v2c0 1.1-.9 2-2 2s-2-.9-2-2v-2c0-.6.4-1 1-1h2zm-1 9l-2 4h4l-2-4zm1-15l-1 3-2-1 1 3-3-1 2 4-4-1 3 3-4 1 5 1v3h2v-3l5-1-4-1 3-3-4 1 2-4-3 1 1-3-2 1-1-3z",
    colors: {
      ring: 'border-amber-700/80',
      gradientFrom: 'from-yellow-300',
      gradientTo: 'to-amber-600',
      glow: 'bg-yellow-500/40',
      border: 'border-yellow-400/50'
    }
  }
];