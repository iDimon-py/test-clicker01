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
import { Trophy, Gift, Clock, Users, X, LogIn, Gamepad2, Loader2 } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoginProcessing, setIsLoginProcessing] = useState(false);
  
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
  
  const textIdRef = useRef(0);

  // Initial Auto-Login Check
  useEffect(() => {
    const initSession = async () => {
      const savedUser = await DB.getSessionUser();
      if (savedUser) {
        setupUser(savedUser);
      }
      setIsLoading(false);
    };
    initSession();
  }, []);

  const setupUser = (user: UserData) => {
    setCurrentUser(user);
    setScore(user.score);
    setLastRewardTime(user.lastRewardTime);
    
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
    const user = await DB.loginUser(usernameInput.trim());
    setIsLoginProcessing(false);

    if (user) {
      setupUser(user);
    } else {
        alert("Connection error. Please try again.");
    }
  };

  const handleLogout = () => {
    DB.logoutUser();
    setCurrentUser(null);
    setShowLeaderboard(false);
    setUsernameInput('');
    setScore(0);
    setEnergy(MAX_ENERGY);
  };

  // Sync with DB - DEBOUNCED / PERIODIC
  // Instead of syncing every render, we sync every 3 seconds if data changed
  useEffect(() => {
    if (!currentUser) return;

    const syncInterval = setInterval(() => {
        // We just blindly send current state to DB every few seconds
        // Supabase handles this fine, and it prevents lag on click
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
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-600 rounded-xl px-4 py-3 text-center text-lg font-bold placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-white"
                  autoFocus
                  disabled={isLoginProcessing}
                />
              </div>
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

  // --- GAME SCREEN ---
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
        <div className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 drop-shadow-lg animate-in zoom-in duration-300">
          {score.toLocaleString()}
        </div>
        <div className="mt-2 text-xs font-mono text-slate-500">
          Player: <span className="text-cyan-400">{currentUser.username}</span>
        </div>
      </header>

      {/* Main Interaction Area */}
      <main className="flex-1 flex flex-col items-center justify-center relative z-10 w-full">
        <ClickButton onClick={handleTap} disabled={energy < ENERGY_COST_PER_CLICK} />
        
        {/* Floating Text */}
        {floatingTexts.map((text) => (
          <div
            key={text.id}
            className={`absolute pointer-events-none animate-float-up font-bold text-4xl drop-shadow-[0_0_10px_rgba(59,130,246,0.8)] z-50 whitespace-nowrap`}
            style={{ 
              left: text.x, 
              top: text.y,
              marginLeft: '-20px', 
              marginTop: '-40px',
              color: text.value > 10 ? '#fde047' : 'white',
              fontSize: text.value > 10 ? '3rem' : '2.25rem'
            }}
          >
            +{text.value} {text.value > 10 ? '🎁' : ''}
          </div>
        ))}
      </main>

      {/* Footer / Controls */}
      <footer className="flex-none w-full flex flex-col items-center pb-8 z-10 px-4">
        <EnergyBar current={energy} />
        
        <div className="flex items-center gap-3 w-full justify-center max-w-md">
          {/* Hourly Reward */}
          <button 
            onClick={handleClaimReward}
            disabled={!!timeRemaining}
            className={`
              flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border backdrop-blur-md transition-all duration-300
              ${timeRemaining 
                ? 'bg-slate-900/50 border-slate-800 opacity-70 cursor-not-allowed' 
                : 'bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border-yellow-500/30 hover:bg-yellow-600/30 hover:border-yellow-500/50 cursor-pointer shadow-[0_0_15px_rgba(234,179,8,0.2)]'
              }
            `}
          >
            {timeRemaining ? (
              <>
                <Clock className="w-5 h-5 text-slate-400" />
                <span className="text-sm font-mono font-bold text-slate-400">{timeRemaining}</span>
              </>
            ) : (
              <>
                <Gift className="w-5 h-5 text-yellow-400 animate-pulse" />
                <span className="text-sm font-bold text-yellow-100 uppercase tracking-wide">Bonus</span>
              </>
            )}
          </button>

          {/* Leaderboard */}
          <button 
            onClick={() => setShowLeaderboard(true)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:bg-blue-900/20 hover:border-blue-500/30 transition-all duration-300 backdrop-blur-md cursor-pointer"
          >
            <Users className="w-5 h-5 text-blue-400" />
            <span className="text-sm font-bold text-blue-100 uppercase tracking-wide">Top</span>
          </button>
        </div>
      </footer>

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-slate-900/95 border border-slate-700 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[80vh]">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[50px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 blur-[50px] pointer-events-none" />

                <div className="flex justify-between items-center mb-6 relative z-10 flex-none">
                    <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
                        <Trophy className="w-6 h-6 text-yellow-500" />
                        Leaderboard
                    </h2>
                    <button 
                        onClick={() => setShowLeaderboard(false)}
                        className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <div className="space-y-3 relative z-10 overflow-y-auto pr-2 custom-scrollbar min-h-[200px]">
                    {leaderboardLoading ? (
                        <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                            <span>Loading Galaxy Rank...</span>
                        </div>
                    ) : (
                        <>
                            {leaderboardData.length === 0 && (
                                <div className="text-center text-slate-500 py-4">No players yet.</div>
                            )}
                            {leaderboardData.map((user, index) => {
                                const isMe = user.username === currentUser.username;
                                return (
                                <div 
                                    key={user.username} 
                                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                        isMe
                                        ? 'bg-blue-600/20 border-blue-500/50 scale-[1.01] shadow-[0_0_15px_rgba(59,130,246,0.2)] sticky top-0 z-20 backdrop-blur-md' 
                                        : 'bg-slate-800/50 border-slate-700/50'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={`text-lg font-bold w-6 flex justify-center ${
                                            index === 0 ? 'text-yellow-400' : 
                                            index === 1 ? 'text-slate-300' : 
                                            index === 2 ? 'text-amber-600' : 'text-slate-500'
                                        }`}>
                                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                                        </span>
                                        <div className="flex flex-col">
                                            <span className={`font-semibold truncate max-w-[120px] ${isMe ? 'text-blue-200' : 'text-slate-200'}`}>
                                                {user.username} {isMe && '(You)'}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="font-mono font-bold text-slate-300">
                                        {user.score.toLocaleString()}
                                    </span>
                                </div>
                                );
                            })}
                        </>
                    )}
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-800 text-center flex-none">
                   <button 
                     onClick={handleLogout}
                     className="text-xs text-slate-500 hover:text-white transition-colors"
                   >
                     Log Out
                   </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}