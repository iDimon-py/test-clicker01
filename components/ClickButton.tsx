import React, { useState, useCallback } from 'react';

interface ClickButtonProps {
  onClick: (e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => void;
  disabled: boolean;
}

export const ClickButton: React.FC<ClickButtonProps> = ({ onClick, disabled }) => {
  const [isPressed, setIsPressed] = useState(false);

  const handleStart = () => setIsPressed(true);
  const handleEnd = () => setIsPressed(false);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
    if (disabled) return;
    onClick(e);
  };

  return (
    <div className="relative flex items-center justify-center w-full h-full max-h-[400px] aspect-square">
      {/* Background Glow Ring */}
      <div className={`absolute inset-0 rounded-full blur-[60px] transition-all duration-500 ${disabled ? 'bg-red-900/20' : 'bg-blue-600/30'}`} />

      <button
        className={`
          relative w-64 h-64 sm:w-80 sm:h-80 rounded-full 
          flex items-center justify-center
          transition-all duration-100 ease-in-out
          focus:outline-none touch-manipulation
          ${isPressed && !disabled ? 'scale-95' : 'scale-100'}
          ${disabled ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer hover:scale-105 active:scale-95'}
        `}
        onMouseDown={handleStart}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchEnd={handleEnd}
        onClick={handleClick}
        disabled={disabled}
      >
        {/* Outer Ring */}
        <div className={`absolute inset-0 rounded-full border-4 border-slate-800/80 bg-slate-900/90 shadow-2xl backdrop-blur-md overflow-hidden z-10`}>
             {/* Inner Gradient - simulates a planet or energy core */}
            <div className={`w-full h-full rounded-full bg-gradient-to-br ${disabled ? 'from-slate-700 to-slate-900' : 'from-cyan-500 via-blue-600 to-purple-700'} opacity-90 relative overflow-hidden`}>
                
                {/* Surface detail texture */}
                <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] mix-blend-overlay"></div>
                
                {/* Shine reflection */}
                <div className="absolute top-4 left-10 w-24 h-12 bg-white/20 blur-xl rounded-full transform -rotate-12"></div>
                
                {/* Shadow */}
                <div className="absolute bottom-0 right-0 w-full h-1/2 bg-black/40 blur-2xl rounded-full"></div>
            </div>
        </div>

        {/* Pulse Ring Animation (Only when active) */}
        {!disabled && (
           <div className="absolute -inset-4 rounded-full border-2 border-cyan-500/30 animate-pulse-glow z-0"></div>
        )}
      </button>
    </div>
  );
};