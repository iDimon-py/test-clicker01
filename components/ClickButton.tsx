import React, { useState, useRef, useEffect } from 'react';

interface ClickButtonProps {
  onClick: (e: React.PointerEvent<HTMLDivElement>) => void;
  disabled: boolean;
  multiplier: number;
}

export const ClickButton: React.FC<ClickButtonProps> = ({ onClick, disabled, multiplier }) => {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [transformStyle, setTransformStyle] = useState<string>('');
  const [isPressed, setIsPressed] = useState(false);

  // Reset tilt after a short delay to simulate "spring back"
  useEffect(() => {
    if (transformStyle) {
      const timer = setTimeout(() => {
        setTransformStyle('');
        setIsPressed(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [transformStyle]);

  const handleInteraction = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    
    // Critical fix for mobile: prevent default browser actions (scrolling/zooming/emulated mouse clicks)
    e.preventDefault();

    // Call the parent click handler immediately
    onClick(e);
    setIsPressed(true);

    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      
      // PointerEvent unifies mouse and touch coordinates
      const clientX = e.clientX;
      const clientY = e.clientY;

      // Calculate distance from center
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const offsetX = clientX - centerX;
      const offsetY = clientY - centerY;

      // Calculate rotation (Cymbal effect)
      const maxRot = 20; 
      
      const rotateX = -(offsetY / (rect.height / 2)) * maxRot; 
      const rotateY = (offsetX / (rect.width / 2)) * maxRot;

      // Apply 3D transform
      setTransformStyle(`perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(0.95)`);
    }
  };

  return (
    <div className="relative flex items-center justify-center w-full h-full max-h-[400px] aspect-square">
      {/* Background Glow Ring */}
      <div className={`absolute inset-0 rounded-full blur-[60px] transition-all duration-500 ${disabled ? 'bg-red-900/20' : multiplier > 1 ? 'bg-yellow-500/40 animate-pulse' : 'bg-blue-600/30'}`} />

      <div
        ref={buttonRef}
        className={`
          relative w-64 h-64 sm:w-80 sm:h-80 rounded-full 
          flex items-center justify-center
          focus:outline-none touch-none select-none
          ${disabled ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer'}
        `}
        style={{
          transform: transformStyle || 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)',
          transition: 'transform 0.1s cubic-bezier(0.1, 0.7, 1.0, 0.1)' // Snappy spring
        }}
        onPointerDown={handleInteraction}
      >
        {/* Outer Ring / Rim */}
        <div className={`
            absolute inset-0 rounded-full border-4 
            ${multiplier > 1 ? 'border-yellow-500/80' : 'border-slate-800/80'} 
            bg-slate-900/90 shadow-2xl backdrop-blur-md overflow-hidden z-10 transition-colors duration-300 pointer-events-none
        `}>
             {/* Inner Gradient - Planet Core */}
            <div className={`
                w-full h-full rounded-full bg-gradient-to-br 
                ${disabled ? 'from-slate-700 to-slate-900' : multiplier > 1 ? 'from-yellow-400 via-orange-500 to-red-600' : 'from-cyan-500 via-blue-600 to-purple-700'} 
                opacity-90 relative overflow-hidden transition-colors duration-500
            `}>
                
                {/* Surface Texture */}
                <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] mix-blend-overlay"></div>
                
                {/* Center Anchor Point (The Cymbal Stand) */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-black/20 rounded-full blur-md z-20"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white/10 rounded-full border border-white/20 z-30 shadow-inner"></div>

                {/* Shine reflection */}
                <div className="absolute top-4 left-10 w-24 h-12 bg-white/20 blur-xl rounded-full transform -rotate-12"></div>
                
                {/* Shadow */}
                <div className="absolute bottom-0 right-0 w-full h-1/2 bg-black/40 blur-2xl rounded-full"></div>
            </div>
        </div>

        {/* Pulse Ring Animation */}
        {!disabled && (
           <div className={`absolute -inset-4 rounded-full border-2 ${multiplier > 1 ? 'border-yellow-400/50' : 'border-cyan-500/30'} animate-pulse-glow z-0 pointer-events-none`}></div>
        )}
      </div>
    </div>
  );
};