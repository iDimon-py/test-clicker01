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
  REWARD_MAX
} from './constants';
import { FloatingText, UserData } from './types';
import * as DB from './db';
import { Trophy, Gift, Clock, Users, X, LogIn, Gamepad2, Loader2, AlertCircle, WifiOff, Cloud } from 'lucide-react';

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
  
  // UI State
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<UserData[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  
  const textIdRef = useRef(0);

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
    
    // Calculate offline energy
    const now = Date.now();
    const lastUpdated = user.lastUpdated || now;
    const timeDiff = now - lastUpdated;
    const cycles = Math.floor(timeDiff / ENERGY_REGEN_RATE_MS);
    const offlineRegen = cycles * ENERGY_REGEN_AMOUNT;
    
    setEnergy(Math.min(MAX_ENERGY, user.energy + offlineRegen));
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
        // Just show a small toast or log it, don't block
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
    setUsernameInput('');
    setScore(0);
    setEnergy(MAX_ENERGY);
    setLoginError(null);
    setIsOfflineMode(false);
  };

  // Sync with DB
  useEffect(() => {
    if (!currentUser) return;

    const syncInterval = setInterval(() => {
        DB.updateUserProgress(currentUser.username, {
            score,
            energy,
            lastRewardTime
        });
    }, 3000); // Save every 3 seconds

    return () => clearInterval(syncInterval);
  }, [currentUser, score, energy, lastRewardTime]);

  // Energy Regen Loop
  useEffect(() => {
    if (!currentUser) return;

    const timer = setInterval(() => {
      setEnergy((prevEnergy) => {
        if (prevEnergy >= MAX_ENERGY) return MAX_ENERGY;
        return Math.min(prevEnergy + ENERGY_REGEN_AMOUNT, MAX_ENERGY);
      });
    }, ENERGY_REGEN_RATE_MS);

    return () => clearInterval(timer);
  }, [currentUser]);

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
      DB.getLeaderboard().then(data => {
          setLeaderboardData(data);
          setLeaderboardLoading(false);
      });
    }
  }, [showLeaderboard]);

  // Click Interaction
  const handleTap = (e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
    if (energy < ENERGY_COST_PER_CLICK) return;

    setScore((prev) => prev + 1);
    setEnergy((prev) => Math.max(0, prev - ENERGY_COST_PER_CLICK));
    spawnFloatingText(e, 1);
  };

  const spawnFloatingText = (e: React.MouseEvent | React.TouchEvent | {clientX: number, clientY: number}, value: number) => {
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as any).clientX;
      clientY = (e as any).clientY;
    } else {
      clientX = window.innerWidth / 2;
      clientY = window.innerHeight / 2;
    }

    const newText: FloatingText = {
      id: textIdRef.current++,
      x: clientX,
      y: clientY,
      value: value
    };
    
    setFloatingTexts((prev) => [...prev, newText]);
    setTimeout(() => {
      setFloatingTexts((prev) => prev.filter((t) => t.id !== newText.id));
    }, 1000);
  };

  const handleClaimReward = () => {
    const now = Date.now();
    if (now - lastRewardTime < REWARD_COOLDOWN_MS) return;

    const rewardAmount = Math.floor(Math.random() * (REWARD_MAX - REWARD_MIN + 1)) + REWARD_MIN;
    setScore(prev => prev + rewardAmount);
    setLastRewardTime(now);

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const id = textIdRef.current++;
    const bonusText: FloatingText = { id, x: centerX, y: centerY, value: rewardAmount };
    setFloatingTexts(prev => [...prev, bonusText]);
    setTimeout(() => setFloatingTexts(prev => prev.filter(t => t.id !== id)), 1500);
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
       <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-40"></div>
       <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-slate-900 via-slate-900/50 to-black z-0 pointer-events-none"></div>

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
            <span className="text-slate-400 text-sm uppercase tracking-[0.3em] mb-1">Total Score</span>
            <div className="flex items-center gap-2">
               <span className="text-5xl sm:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                 {score.toLocaleString()}
               </span>
            </div>
          </div>

          {/* Interaction Area */}
          <div className="relative w-full max-w-[320px] aspect-square mb-8">
             <ClickButton onClick={handleTap} disabled={energy < ENERGY_COST_PER_CLICK} />
             
             {/* Floating Numbers */}
             {floatingTexts.map((text) => (
               <div
                 key={text.id}
                 className="absolute pointer-events-none text-2xl font-bold text-white animate-float-up z-50 drop-shadow-md"
                 style={{ 
                   left: '50%', 
                   top: '40%',
                   // Using fixed positioning relative to button center for consistent look
                   transform: `translate(-50%, -50%)`,
                 }}
               >
                 +{text.value}
               </div>
             ))}
          </div>

          {/* Energy Bar */}
          <EnergyBar current={energy} />

       </div>

       {/* Footer / Controls */}
       <div className="relative z-20 w-full px-6 py-6 pb-8 bg-gradient-to-t from-black via-black/90 to-transparent flex items-center justify-between gap-4 max-w-md mx-auto">
          
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
               {timeRemaining || "Claim Gift"}
             </span>
          </button>

          {/* Leaderboard Button */}
          <button 
             onClick={() => setShowLeaderboard(true)}
             className="flex-1 flex flex-col items-center justify-center gap-1 p-3 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800 transition-all hover:border-slate-500 shadow-lg"
          >
             <Trophy className="w-6 h-6 text-yellow-500" />
             <span className="text-xs font-bold uppercase tracking-wider">Rankings</span>
          </button>
       </div>

       {/* Floating Texts Container (Global) - for accurate positioning if needed */}
       {/* Note: In this design, floating text is inside the button container for relative positioning */}

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