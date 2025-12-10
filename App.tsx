import React, { useState, useEffect, useRef } from 'react';
import { ClickButton } from './components/ClickButton';
import { EnergyBar } from './components/EnergyBar';
import { MAX_ENERGY, ENERGY_REGEN_RATE_MS, ENERGY_REGEN_AMOUNT, ENERGY_COST_PER_CLICK } from './constants';
import { FloatingText } from './types';
import { Trophy, RefreshCw } from 'lucide-react';

const STORAGE_KEY = 'cosmic_clicker_save_v1';

export default function App() {
  // Initialize state from LocalStorage to prevent flash of 0 and enable offline regen
  const [score, setScore] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved).score : 0;
    } catch (e) {
      return 0;
    }
  });

  const [energy, setEnergy] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return MAX_ENERGY;
      
      const parsed = JSON.parse(saved);
      const lastUpdated = parsed.lastUpdated || Date.now();
      const now = Date.now();
      
      // Calculate how much energy was restored while offline
      const timeDiff = now - lastUpdated;
      const cycles = Math.floor(timeDiff / ENERGY_REGEN_RATE_MS);
      const offlineRegen = cycles * ENERGY_REGEN_AMOUNT;
      
      return Math.min(MAX_ENERGY, (parsed.energy || 0) + offlineRegen);
    } catch (e) {
      return MAX_ENERGY;
    }
  });

  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const textIdRef = useRef(0);

  // Persistence Effect: Save data whenever score or energy changes
  useEffect(() => {
    const stateToSave = {
      score,
      energy,
      lastUpdated: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [score, energy]);

  // Active Energy Regeneration Logic (while app is open)
  useEffect(() => {
    const timer = setInterval(() => {
      setEnergy((prevEnergy) => {
        if (prevEnergy >= MAX_ENERGY) return MAX_ENERGY;
        return Math.min(prevEnergy + ENERGY_REGEN_AMOUNT, MAX_ENERGY);
      });
    }, ENERGY_REGEN_RATE_MS);

    return () => clearInterval(timer);
  }, []);

  // Handle Click Logic
  const handleTap = (e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
    if (energy < ENERGY_COST_PER_CLICK) {
      return;
    }

    // Update state
    setScore((prev) => prev + 1);
    setEnergy((prev) => Math.max(0, prev - ENERGY_COST_PER_CLICK));

    // Calculate click position for floating text
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    // Add floating text
    const newText: FloatingText = {
      id: textIdRef.current++,
      x: clientX,
      y: clientY,
      value: 1
    };
    
    setFloatingTexts((prev) => [...prev, newText]);

    // Clean up floating text after animation
    setTimeout(() => {
      setFloatingTexts((prev) => prev.filter((t) => t.id !== newText.id));
    }, 1000);
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset your progress?")) {
      setScore(0);
      setEnergy(MAX_ENERGY);
      setFloatingTexts([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-900 via-slate-950 to-black text-white flex flex-col relative overflow-hidden font-sans">
      
      {/* Background Ambient Effects */}
      <div className="absolute top-0 left-0 w-full h-96 bg-purple-900/20 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-full h-96 bg-blue-900/10 blur-[100px] pointer-events-none" />

      {/* Header / Score Board */}
      <header className="flex-none pt-12 pb-4 flex flex-col items-center justify-center z-10">
        <div className="flex items-center gap-2 mb-2 opacity-80">
          <Trophy className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-semibold tracking-widest uppercase text-slate-400">Total Score</span>
        </div>
        <div className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 drop-shadow-lg">
          {score.toLocaleString()}
        </div>
      </header>

      {/* Main Interaction Area */}
      <main className="flex-1 flex flex-col items-center justify-center relative z-10 w-full">
        <ClickButton onClick={handleTap} disabled={energy < ENERGY_COST_PER_CLICK} />
        
        {/* Floating Text Container (Overlay) */}
        {floatingTexts.map((text) => (
          <div
            key={text.id}
            className="absolute pointer-events-none animate-float-up font-bold text-4xl text-white drop-shadow-[0_0_10px_rgba(59,130,246,0.8)] z-50"
            style={{ 
              left: text.x, 
              top: text.y,
              marginLeft: '-15px', // Center horizonally relative to click
              marginTop: '-40px'   // Offset slightly up
            }}
          >
            +{text.value}
          </div>
        ))}
      </main>

      {/* Footer / Controls */}
      <footer className="flex-none w-full flex flex-col items-center pb-8 z-10">
        <EnergyBar current={energy} />
        
        <button 
          onClick={handleReset}
          className="group flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:bg-red-900/20 hover:border-red-900/50 transition-all duration-300 backdrop-blur-md"
        >
          <RefreshCw className="w-4 h-4 text-slate-500 group-hover:text-red-400 transition-colors group-hover:rotate-180 duration-500" />
          <span className="text-xs font-medium text-slate-500 group-hover:text-red-400 uppercase tracking-widest">
            Reset Progress
          </span>
        </button>
      </footer>
    </div>
  );
}