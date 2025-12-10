import React from 'react';
import { MAX_ENERGY } from '../constants';
import { Zap } from 'lucide-react';

interface EnergyBarProps {
  current: number;
}

export const EnergyBar: React.FC<EnergyBarProps> = ({ current }) => {
  const percentage = Math.min((current / MAX_ENERGY) * 100, 100);
  
  // Determine color based on energy level
  let barColor = 'bg-gradient-to-r from-blue-500 to-cyan-400';
  if (percentage < 20) barColor = 'bg-gradient-to-r from-red-500 to-orange-400';
  else if (percentage < 50) barColor = 'bg-gradient-to-r from-yellow-500 to-amber-400';

  return (
    <div className="w-full max-w-md px-6 mb-8 select-none">
      <div className="flex justify-between items-end mb-2">
        <div className="flex items-center gap-2 text-cyan-300">
           <Zap className="w-5 h-5 fill-current" />
           <span className="font-bold text-lg tracking-wider">Energy</span>
        </div>
        <span className="text-sm font-mono text-slate-400">
          {Math.floor(current)} <span className="text-slate-600">/</span> {MAX_ENERGY}
        </span>
      </div>
      
      <div className="h-4 bg-slate-800/50 rounded-full overflow-hidden backdrop-blur-sm border border-slate-700/50 shadow-inner">
        <div 
          className={`h-full ${barColor} transition-all duration-300 ease-out shadow-[0_0_15px_rgba(6,182,212,0.5)]`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="mt-1 text-center">
        <span className="text-[10px] text-slate-500 uppercase tracking-[0.2em]">Restores 1 every 3s</span>
      </div>
    </div>
  );
};