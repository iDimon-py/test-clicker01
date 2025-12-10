import React, { useState, useEffect, useRef } from 'react';
import { ClickButton } from './components/ClickButton';
import { EnergyBar } from './components/EnergyBar';
import { 
  MAX_ENERGY, 
  ENERGY_REGEN_RATE_MS, 
  ENERGY_REGEN_AMOUNT, 
  ENERGY_COST_PER_CLICK,
  REWARD_COOLDOWN_MS,
  REWARD_MIN,
  REWARD_MAX,
  SKINS,
  SkinConfig
} from './constants';
import { FloatingText, Particle, UserData } from './types';
import * as DB from './db';
import { Trophy, Gift, X, LogIn, Gamepad2, Loader2, AlertCircle, WifiOff, Cloud, Rocket, ShoppingBag, Check, Lock } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoginProcessing, setIsLoginProcessing] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  
  // Game State
  const [score, setScore] = useState<number>(0);
  const [energy, setEnergy] = useState<number>(MAX_ENERGY);
  const [lastRewardTime, setLastRewardTime] = useState<number>(0);
  const [multiplier, setMultiplier] = useState<number>(1);
  const [multiplierEndTime, setMultiplierEndTime] = useState<number>(0);
  const [ownedSkins, setOwnedSkins] = useState<number[]>([0]);
  const [currentSkinId, setCurrentSkinId] = useState<number>(0);
  
  // Bonus State
  const [showBonus, setShowBonus] = useState(false);
  const [bonusPosition, setBonusPosition] = useState({ top: '50%', left: '50%' });

  // UI State
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  
  // OPTIMIZATION: Use Ref for particles instead of State to avoid React Re-renders
  const particlesRef = useRef<Particle[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particleIdRef = useRef(0);

  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<UserData[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  
  const textIdRef = useRef(0);

  // Derived State based on Skin
  const activeSkin = SKINS.find(s => s.id === currentSkinId) || SKINS[0];
  const maxEnergy = activeSkin.maxEnergy;
  const regenRate = activeSkin.regenRateSec * 1000;
  const skinClickValue = activeSkin.clickMultiplier;

  // Initial Auto-Login Check
  useEffect(() => {
    const initSession = async () => {
      const savedUser = await DB.getSessionUser();
      if (savedUser) {
        setupUser(savedUser, false);
      }
      setIsLoading(false);
    };
    initSession();
  }, []);

  const setupUser = (user: UserData, offline: boolean) => {
    setCurrentUser(user);
    setScore(user.score);
    setLastRewardTime(user.lastRewardTime);
    setIsOfflineMode(offline);
    setOwnedSkins(user.ownedSkins || [0]);
    setCurrentSkinId(user.currentSkin || 0);
    
    // Calculate offline energy with current skin logic (approximation)
    // Note: If they changed skin offline, this might be slightly off, but acceptable.
    const userSkin = SKINS.find(s => s.id === (user.currentSkin || 0)) || SKINS[0];
    const userMaxEnergy = userSkin.maxEnergy;
    const userRegenRate = userSkin.regenRateSec * 1000;

    const now = Date.now();
    const lastUpdated = user.lastUpdated || now;
    const timeDiff = now - lastUpdated;
    const cycles = Math.floor(timeDiff / userRegenRate);
    const offlineRegen = cycles * ENERGY_REGEN_AMOUNT;
    
    setEnergy(Math.min(userMaxEnergy, user.energy + offlineRegen));
  };

  // Login Handler
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!usernameInput.trim()) return;

    setIsLoginProcessing(true);
    setLoginError(null);
    
    const { user, error, offline } = await DB.loginUser(usernameInput.trim());
    
    setIsLoginProcessing(false);

    if (user) {
      if (offline) {
        console.log(error); 
      }
      setupUser(user, offline);
    } else {
        console.error(error);
        setLoginError(error || "Unknown connection error");
    }
  };

  const handleLogout = () => {
    DB.logoutUser();
    setCurrentUser(null);
    setShowLeaderboard(false);
    setShowShop(false);
    setUsernameInput('');
    setScore(0);
    setEnergy(MAX_ENERGY);
    setLoginError(null);
    setIsOfflineMode(false);
    setOwnedSkins([0]);
    setCurrentSkinId(0);
  };

  // Sync with DB
  useEffect(() => {
    if (!currentUser) return;

    const syncInterval = setInterval(() => {
        DB.updateUserProgress(currentUser.username, {
            score,
            energy,
            lastRewardTime,
            ownedSkins,
            currentSkin: currentSkinId
        });
    }, 10000); // Changed from 3000 to 10000 (10 seconds)

    return () => clearInterval(syncInterval);
  }, [currentUser, score, energy, lastRewardTime, ownedSkins, currentSkinId]);

  // Energy Regen Loop (Dynamic based on Skin)
  useEffect(() => {
    if (!currentUser) return;

    const timer = setInterval(() => {
      setEnergy((prevEnergy) => {
        if (prevEnergy >= maxEnergy) return maxEnergy;
        return Math.min(prevEnergy + ENERGY_REGEN_AMOUNT, maxEnergy);
      });
    }, regenRate); // Uses variable derived from state

    return () => clearInterval(timer);
  }, [currentUser, maxEnergy, regenRate]);

  // Multiplier Timer Loop
  useEffect(() => {
      if (multiplier <= 1) return;
      
      const interval = setInterval(() => {
          if (Date.now() > multiplierEndTime) {
              setMultiplier(1);
          }
      }, 1000);
      return () => clearInterval(interval);
  }, [multiplier, multiplierEndTime]);

  // --- RANDOM BONUS LOGIC ---
  useEffect(() => {
    if (!currentUser) return;

    const scheduleNextBonus = () => {
        // Random time between 30 and 120 seconds
        const minDelay = 30000;
        const maxDelay = 120000;
        const delay = Math.random() * (maxDelay - minDelay) + minDelay;
        
        return setTimeout(() => {
            spawnBonus();
            // Schedule the next one recursively
            scheduleNextBonus();
        }, delay);
    };

    const timerId = scheduleNextBonus();
    return () => clearTimeout(timerId);
  }, [currentUser]);

  const spawnBonus = () => {
      // Random start position
      const top = Math.random() * 80 + 10; // 10% to 90%
      const left = Math.random() * 80 + 10; 
      setBonusPosition({ top: `${top}%`, left: `${left}%` });
      setShowBonus(true);
      
      // Bonus disappears if not clicked after 8 seconds
      setTimeout(() => setShowBonus(false), 8000);
  };

  const handleBonusClick = () => {
      setShowBonus(false);
      const duration = Math.floor(Math.random() * (15000 - 5000) + 5000); // 5-15s
      setMultiplier(10);
      setMultiplierEndTime(Date.now() + duration);
      
      // Visual feedback
      const id = textIdRef.current++;
      setFloatingTexts(prev => [...prev, {
          id,
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
          value: 10,
          type: 'bonus'
      }]);
      setTimeout(() => setFloatingTexts(prev => prev.filter(t => t.id !== id)), 2000);
  };

  // Reward Timer Loop
  useEffect(() => {
    if (!currentUser) return;

    const updateTimer = () => {
      const now = Date.now();
      const diff = now - lastRewardTime;
      
      if (diff >= REWARD_COOLDOWN_MS) {
        setTimeRemaining("");
      } else {
        const remaining = REWARD_COOLDOWN_MS - diff;
        const minutes = Math.floor((remaining / 1000 / 60) % 60);
        const seconds = Math.floor((remaining / 1000) % 60);
        setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [lastRewardTime, currentUser]);

  // Leaderboard data fetch
  useEffect(() => {
    if (showLeaderboard) {
      setLeaderboardLoading(true);
      
      // OPTIMIZATION: Force sync current score before fetching leaderboard
      // This ensures "My Rank" is accurate immediately in the list
      if (currentUser) {
          DB.updateUserProgress(currentUser.username, {
              score,
              energy,
              lastRewardTime,
              ownedSkins,
              currentSkin: currentSkinId
          }).then(() => {
             // Fetch after sync completes
             DB.getLeaderboard().then(data => {
                setLeaderboardData(data);
                setLeaderboardLoading(false);
             });
          });
      } else {
         DB.getLeaderboard().then(data => {
            setLeaderboardData(data);
            setLeaderboardLoading(false);
         });
      }
    }
  }, [showLeaderboard]);

  // --- CLICK INTERACTION ---
  const handleTap = (e: React.PointerEvent<HTMLDivElement>) => {
    if (energy < ENERGY_COST_PER_CLICK) return;

    const points = skinClickValue * multiplier; // Uses skin base value
    setScore((prev) => prev + points);
    setEnergy((prev) => Math.max(0, prev - ENERGY_COST_PER_CLICK));
    
    // PointerEvent has clientX/Y
    const clientX = e.clientX;
    const clientY = e.clientY;

    spawnFloatingText(clientX, clientY, points);
    spawnCoinParticles(clientX, clientY);
  };

  const spawnFloatingText = (x: number, y: number, value: number) => {
    const newText: FloatingText = {
      id: textIdRef.current++,
      x,
      y,
      value,
      type: 'score'
    };
    
    setFloatingTexts((prev) => [...prev, newText]);
    setTimeout(() => {
      setFloatingTexts((prev) => prev.filter((t) => t.id !== newText.id));
    }, 1000);
  };

  const spawnCoinParticles = (x: number, y: number) => {
    const count = multiplier > 1 ? 3 : 1; // Reduced from 5 to 3 for better performance

    for (let i = 0; i < count; i++) {
        const angle = (Math.random() * 120 - 150) * (Math.PI / 180); // Spread upward
        const velocity = Math.random() * 8 + 4;
        
        particlesRef.current.push({
            id: particleIdRef.current++,
            x,
            y,
            angle,
            velocity,
            life: 1.0
        });
    }
  };

  // --- CANVAS PARTICLE LOOP (High Performance) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas to fullscreen
    const resizeCanvas = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    let animationFrameId: number;

    const render = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Update and draw particles
        const particles = particlesRef.current;
        
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            
            // Move
            p.x += Math.cos(p.angle) * p.velocity;
            p.y += Math.sin(p.angle) * p.velocity + 1.2; // Gravity
            p.life -= 0.02;

            if (p.life <= 0) {
                particles.splice(i, 1);
            } else {
                // Draw Coin
                ctx.globalAlpha = p.life;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
                
                // Gold Gradient
                const gradient = ctx.createRadialGradient(p.x - 2, p.y - 2, 0, p.x, p.y, 10);
                gradient.addColorStop(0, '#fcd34d'); // lighter yellow
                gradient.addColorStop(1, '#b45309'); // darker gold
                
                ctx.fillStyle = gradient;
                ctx.fill();
                
                // Shine
                ctx.beginPath();
                ctx.arc(p.x - 3, p.y - 3, 3, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,0.6)';
                ctx.fill();
                
                ctx.globalAlpha = 1.0;
            }
        }

        animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
        window.removeEventListener('resize', resizeCanvas);
        cancelAnimationFrame(animationFrameId);
    };
  }, []); // Run once on mount


  const handleClaimReward = () => {
    const now = Date.now();
    if (now - lastRewardTime < REWARD_COOLDOWN_MS) return;

    const rewardAmount = Math.floor(Math.random() * (REWARD_MAX - REWARD_MIN + 1)) + REWARD_MIN;
    setScore(prev => prev + rewardAmount);
    setLastRewardTime(now);

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const id = textIdRef.current++;
    const bonusText: FloatingText = { id, x: centerX, y: centerY, value: rewardAmount, type: 'score' };
    setFloatingTexts(prev => [...prev, bonusText]);
    setTimeout(() => setFloatingTexts(prev => prev.filter(t => t.id !== id)), 1500);
  };

  // --- SHOP LOGIC ---
  const handleBuySkin = (skin: SkinConfig) => {
      if (score >= skin.cost) {
          const newScore = score - skin.cost;
          const newOwnedSkins = [...ownedSkins, skin.id];
          
          setScore(newScore);
          setOwnedSkins(newOwnedSkins);
          // Auto equip
          setCurrentSkinId(skin.id);

          // Force immediate sync to save purchase
          if (currentUser) {
            DB.updateUserProgress(currentUser.username, {
                score: newScore,
                energy,
                lastRewardTime,
                ownedSkins: newOwnedSkins,
                currentSkin: skin.id
            });
          }
      }
  };

  const handleEquipSkin = (id: number) => {
      setCurrentSkinId(id);
      
      // Force immediate sync to save selection
      if (currentUser) {
        DB.updateUserProgress(currentUser.username, {
            score,
            energy,
            lastRewardTime,
            ownedSkins,
            currentSkin: id
        });
      }
  };

  if (isLoading) {
    return (
        <div className="min-h-screen w-full bg-black flex flex-col items-center justify-center text-white gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-cyan-500" />
            <span className="text-slate-400 font-mono">Connecting to Universe...</span>
        </div>
    );
  }

  // --- LOGIN SCREEN ---
  if (!currentUser) {
    return (
      <div className="min-h-screen w-full bg-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
         <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 animate-pulse-glow"></div>
         <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[140%] bg-gradient-to-b from-purple-900/40 via-blue-900/20 to-black pointer-events-none" />
         
         <div className="z-10 w-full max-w-sm bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6 transform transition-all animate-fade-in-up">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.6)] mb-2">
              <Gamepad2 className="w-10 h-10 text-white" />
            </div>
            
            <div className="text-center">
              <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-500">
                Cosmic Clicker
              </h1>
              <p className="text-slate-400 mt-2 text-sm">Enter the galaxy to compete</p>
            </div>

            <form onSubmit={handleLogin} className="w-full space-y-4">
              <div className="space-y-2">
                <input 
                  type="text" 
                  placeholder="Enter Username"
                  value={usernameInput}
                  onChange={(e) => {
                      setUsernameInput(e.target.value);
                      setLoginError(null);
                  }}
                  className={`w-full bg-slate-800/50 border rounded-xl px-4 py-3 text-center text-lg font-bold placeholder:text-slate-600 focus:outline-none focus:ring-1 transition-all text-white ${
                      loginError 
                      ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500' 
                      : 'border-slate-600 focus:border-cyan-500 focus:ring-cyan-500'
                  }`}
                  autoFocus
                  disabled={isLoginProcessing}
                />
              </div>

              {loginError && (
                  <div className="p-3 rounded-lg bg-red-900/30 border border-red-500/30 flex items-start gap-2 text-xs text-red-200">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                      <span>{loginError}</span>
                  </div>
              )}

              <button 
                type="submit"
                disabled={!usernameInput.trim() || isLoginProcessing}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-900/40 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoginProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                    <LogIn className="w-5 h-5" />
                )}
                {isLoginProcessing ? 'Connecting...' : 'Start Journey'}
              </button>
            </form>
         </div>
      </div>
    );
  }

  // --- GAME UI ---
  return (
    <div className="min-h-screen w-full bg-black text-white relative overflow-hidden font-sans select-none flex flex-col">
       {/* Ambient Background */}
       <div className={`absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] transition-opacity duration-1000 ${multiplier > 1 ? 'opacity-60' : 'opacity-40'}`}></div>
       <div className={`absolute top-0 left-0 w-full h-full bg-gradient-to-b transition-colors duration-1000 z-0 pointer-events-none ${multiplier > 1 ? 'from-amber-900/40 via-black to-black' : 'from-slate-900 via-slate-900/50 to-black'}`}></div>
       
       {/* Canvas Layer for Particles - High Performance */}
       <canvas 
          ref={canvasRef}
          className="absolute inset-0 z-30 pointer-events-none"
       />

       {/* Navbar / Header */}
       <div className="relative z-10 w-full px-6 py-4 flex justify-between items-center backdrop-blur-sm bg-slate-900/30 border-b border-white/5">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
                <span className="font-bold text-xs">{currentUser.username.substring(0, 2).toUpperCase()}</span>
             </div>
             <div className="flex flex-col">
                <span className="font-bold text-sm tracking-wide">{currentUser.username}</span>
                {isOfflineMode ? (
                  <div className="flex items-center gap-1 text-[10px] text-amber-500">
                    <WifiOff className="w-3 h-3" />
                    <span>Offline Mode</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-[10px] text-green-500">
                    <Cloud className="w-3 h-3" />
                    <span>Online</span>
                  </div>
                )}
             </div>
          </div>
          <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400">
             <X className="w-5 h-5" />
          </button>
       </div>

       {/* Main Content Area */}
       <div className="flex-1 relative z-10 flex flex-col items-center justify-center p-4">
          
          {/* Score Display */}
          <div className="flex flex-col items-center mb-8 animate-fade-in-up">
            <span className={`text-sm uppercase tracking-[0.3em] mb-1 ${multiplier > 1 ? 'text-yellow-400 font-bold' : 'text-slate-400'}`}>
                {multiplier > 1 ? `x${multiplier} BONUS ACTIVE` : 'Total Score'}
            </span>
            <div className="flex items-center gap-2">
               <span className={`text-5xl sm:text-7xl font-black text-transparent bg-clip-text drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-all duration-300 ${multiplier > 1 ? 'bg-gradient-to-b from-yellow-200 to-amber-500 scale-110' : 'bg-gradient-to-b from-white to-slate-400'}`}>
                 {score.toLocaleString()}
               </span>
            </div>
            {multiplier > 1 && (
                <div className="text-xs text-yellow-500 font-mono mt-2">
                    {Math.ceil((multiplierEndTime - Date.now()) / 1000)}s remaining
                </div>
            )}
          </div>

          {/* Interaction Area */}
          <div className="relative w-full max-w-[320px] aspect-square mb-8">
             <ClickButton 
                onClick={handleTap} 
                disabled={energy < ENERGY_COST_PER_CLICK} 
                multiplier={multiplier} 
                skin={activeSkin}
             />
          </div>

          {floatingTexts.map((text) => (
             <div
                 key={text.id}
                 className={`absolute pointer-events-none font-bold animate-float-up z-50 drop-shadow-md whitespace-nowrap ${text.type === 'bonus' ? 'text-4xl text-yellow-400' : 'text-2xl text-white'}`}
                 style={{ 
                   left: text.x, 
                   top: text.y,
                   transform: `translate(-50%, -50%)`,
                 }}
               >
                 {text.type === 'bonus' ? 'x10 POWER!' : `+${text.value}`}
             </div>
          ))}

          {/* Energy Bar */}
          <div className="w-full max-w-md px-6 mb-8 select-none">
            <div className="flex justify-between items-end mb-2">
                <div className="flex items-center gap-2 text-cyan-300">
                    <span className="font-bold text-lg tracking-wider">Energy</span>
                </div>
                <span className="text-sm font-mono text-slate-400">
                    {Math.floor(energy)} <span className="text-slate-600">/</span> {maxEnergy}
                </span>
            </div>
            
            <div className="h-4 bg-slate-800/50 rounded-full overflow-hidden backdrop-blur-sm border border-slate-700/50 shadow-inner">
                <div 
                    className={`h-full ${activeSkin.colors.gradientFrom.replace('from-', 'bg-')} transition-all duration-300 ease-out shadow-[0_0_15px_rgba(6,182,212,0.5)]`}
                    style={{ width: `${Math.min((energy / maxEnergy) * 100, 100)}%` }}
                />
            </div>
            <div className="mt-1 text-center">
                <span className="text-[10px] text-slate-500 uppercase tracking-[0.2em]">Restores 1 every {activeSkin.regenRateSec}s</span>
            </div>
          </div>

       </div>

        {/* RANDOM BONUS OBJECT */}
        {showBonus && (
            <button
                onClick={handleBonusClick}
                className="absolute z-50 animate-fly-random w-16 h-16 flex items-center justify-center"
                style={{
                    top: bonusPosition.top,
                    left: bonusPosition.left,
                }}
            >
                <div className="relative">
                    <Rocket className="w-12 h-12 text-orange-500 fill-orange-500 drop-shadow-[0_0_15px_rgba(249,115,22,0.8)]" />
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-8 bg-gradient-to-t from-transparent to-blue-400 blur-sm"></div>
                </div>
            </button>
        )}

       {/* Footer / Controls */}
       <div className="relative z-20 w-full px-6 py-6 pb-8 bg-gradient-to-t from-black via-black/90 to-transparent flex items-center justify-between gap-4 max-w-md mx-auto">
          
          {/* Shop Button */}
          <button 
             onClick={() => setShowShop(true)}
             className="flex-1 flex flex-col items-center justify-center gap-1 p-3 rounded-2xl bg-gradient-to-br from-pink-600/20 to-purple-600/20 border border-pink-500/30 text-pink-200 hover:bg-pink-600/30 hover:border-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.2)] transition-all"
          >
             <ShoppingBag className="w-6 h-6 text-pink-400" />
             <span className="text-xs font-bold uppercase tracking-wider">Skins</span>
          </button>

          {/* Hourly Reward Button */}
          <button 
             onClick={handleClaimReward}
             disabled={!!timeRemaining}
             className={`
               flex-1 flex flex-col items-center justify-center gap-1 p-3 rounded-2xl border 
               transition-all duration-300
               ${timeRemaining 
                 ? 'bg-slate-900/50 border-slate-800 text-slate-500 cursor-not-allowed' 
                 : 'bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border-indigo-500/50 text-indigo-200 hover:bg-indigo-600/30 hover:border-indigo-400 shadow-[0_0_15px_rgba(79,70,229,0.2)]'}
             `}
          >
             <Gift className={`w-6 h-6 ${!timeRemaining ? 'animate-bounce' : ''}`} />
             <span className="text-xs font-bold uppercase tracking-wider">
               {timeRemaining || "Claim"}
             </span>
          </button>

          {/* Leaderboard Button */}
          <button 
             onClick={() => setShowLeaderboard(true)}
             className="flex-1 flex flex-col items-center justify-center gap-1 p-3 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800 transition-all hover:border-slate-500 shadow-lg"
          >
             <Trophy className="w-6 h-6 text-yellow-500" />
             <span className="text-xs font-bold uppercase tracking-wider">Rank</span>
          </button>
       </div>

       {/* SHOP MODAL */}
       {showShop && (
         <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in-up">
            <div className="w-full max-w-md h-[85vh] sm:h-[650px] bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
                <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-pink-500/10 rounded-lg">
                            <ShoppingBag className="w-6 h-6 text-pink-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Skin Shop</h2>
                            <p className="text-xs text-slate-400">Upgrade your cosmic plate</p>
                        </div>
                    </div>
                    <button onClick={() => setShowShop(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                
                <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex justify-between items-center sticky top-0 z-10">
                     <span className="text-slate-400 text-sm">Your Balance</span>
                     <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">{score.toLocaleString()}</span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {SKINS.map((skin) => {
                        const isOwned = ownedSkins.includes(skin.id);
                        const isEquipped = currentSkinId === skin.id;
                        const canAfford = score >= skin.cost;

                        return (
                            <div key={skin.id} className={`relative p-4 rounded-2xl border ${isEquipped ? 'border-green-500/50 bg-green-900/10' : 'border-slate-700 bg-slate-800/30'} flex flex-col gap-3 transition-all`}>
                                <div className="flex justify-between items-start">
                                    <div className="flex gap-3">
                                        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${skin.colors.gradientFrom} ${skin.colors.gradientTo} shadow-lg`}></div>
                                        <div>
                                            <h3 className="font-bold text-white">{skin.name}</h3>
                                            <div className="flex gap-2 text-xs mt-1">
                                                <span className="bg-slate-800 px-2 py-0.5 rounded text-cyan-300">x{skin.clickMultiplier} Click</span>
                                                <span className="bg-slate-800 px-2 py-0.5 rounded text-orange-300">{skin.maxEnergy} Energy</span>
                                            </div>
                                             <div className="text-xs text-slate-500 mt-1">Regen: {skin.regenRateSec}s</div>
                                        </div>
                                    </div>
                                    {isEquipped && <div className="bg-green-500/20 text-green-400 p-1 rounded-full"><Check className="w-4 h-4" /></div>}
                                </div>

                                <div className="mt-2">
                                    {isOwned ? (
                                        <button 
                                            onClick={() => handleEquipSkin(skin.id)}
                                            disabled={isEquipped}
                                            className={`w-full py-2 rounded-xl font-bold text-sm transition-all ${isEquipped ? 'bg-slate-700/50 text-slate-400 cursor-default' : 'bg-white text-black hover:bg-slate-200'}`}
                                        >
                                            {isEquipped ? 'Equipped' : 'Equip'}
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => handleBuySkin(skin)}
                                            disabled={!canAfford}
                                            className={`w-full py-2 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${canAfford ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/50' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                                        >
                                            {!canAfford && <Lock className="w-3 h-3" />}
                                            Buy for {skin.cost.toLocaleString()}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
         </div>
       )}

       {/* LEADERBOARD MODAL */}
       {showLeaderboard && (
         <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in-up">
            <div className="w-full max-w-md h-[80vh] sm:h-[600px] bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
               
               {/* Modal Header */}
               <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-500/10 rounded-lg">
                      <Trophy className="w-6 h-6 text-yellow-500" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">Leaderboard</h2>
                      <p className="text-xs text-slate-400">Top galactic players</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowLeaderboard(false)}
                    className="p-2 hover:bg-slate-800 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
               </div>

               {/* List */}
               <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {isOfflineMode && (
                     <div className="p-4 rounded-xl bg-amber-900/20 border border-amber-600/30 text-amber-200 text-sm text-center mb-4">
                        Leaderboard unavailable in offline mode.
                     </div>
                  )}

                  {leaderboardLoading ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-3">
                       <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
                       <span className="text-slate-500 text-sm">Loading rankings...</span>
                    </div>
                  ) : leaderboardData.length > 0 ? (
                    leaderboardData.map((user, index) => (
                      <div 
                        key={index} 
                        className={`
                          flex items-center p-3 rounded-xl border transition-all
                          ${user.username === currentUser.username 
                             ? 'bg-blue-900/20 border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
                             : 'bg-slate-800/30 border-slate-700/50'}
                        `}
                      >
                         <div className={`
                            w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm mr-4
                            ${index === 0 ? 'bg-yellow-500 text-black' : 
                              index === 1 ? 'bg-slate-300 text-black' : 
                              index === 2 ? 'bg-amber-600 text-black' : 'bg-slate-700 text-slate-400'}
                         `}>
                            {index + 1}
                         </div>
                         <div className="flex-1">
                            <div className="font-semibold text-sm">{user.username}</div>
                            <div className="text-xs text-slate-500">Score: {user.score.toLocaleString()}</div>
                         </div>
                         {index < 3 && <Trophy className={`w-4 h-4 ${index===0?'text-yellow-500':index===1?'text-slate-300':'text-amber-600'}`} />}
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-slate-500 py-10">No players found</div>
                  )}
               </div>
               
               {/* Modal Footer (My Rank) */}
               {!isOfflineMode && currentUser && (
                 <div className="p-4 bg-slate-800 border-t border-slate-700 flex justify-between items-center text-sm">
                    <span className="text-slate-400">My Score:</span>
                    <span className="font-bold text-cyan-400">{score.toLocaleString()}</span>
                 </div>
               )}
            </div>
         </div>
       )}
    </div>
  );
}