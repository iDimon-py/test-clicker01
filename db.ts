import { createClient } from '@supabase/supabase-js';
import { UserData } from './types';
import { MAX_ENERGY } from './constants';

// --- CONFIGURATION ---
const SUPABASE_URL = 'https://tacmjrrbmngeyuhtvfvt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhY21qcnJibW5nZXl1aHR2ZnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNjc4MTcsImV4cCI6MjA4MDk0MzgxN30.FzHYxFDKUBUyGtEoe6BAIYdRnsXEs9yH5BhbaFg9YH0';
const SESSION_KEY = 'cosmic_clicker_session_user';
const OFFLINE_DATA_PREFIX = 'cosmic_offline_data_';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- HELPER TYPES ---
interface DBUser {
  username: string;
  score: number;
  energy: number;
  last_updated: number;
  last_reward_time: number;
  owned_skins: number[];
  current_skin: number;
}

const mapFromDB = (data: DBUser): UserData => ({
  username: data.username,
  score: data.score,
  energy: data.energy,
  lastUpdated: data.last_updated,
  lastRewardTime: data.last_reward_time,
  ownedSkins: data.owned_skins || [0], // Default to skin 0 if null
  currentSkin: data.current_skin || 0,
});

const mapToDB = (data: Partial<UserData>): Partial<DBUser> => {
  const mapped: Partial<DBUser> = {};
  if (data.username !== undefined) mapped.username = data.username;
  if (data.score !== undefined) mapped.score = data.score;
  if (data.energy !== undefined) mapped.energy = data.energy;
  if (data.lastUpdated !== undefined) mapped.last_updated = data.lastUpdated;
  if (data.lastRewardTime !== undefined) mapped.last_reward_time = data.lastRewardTime;
  if (data.ownedSkins !== undefined) mapped.owned_skins = data.ownedSkins;
  if (data.currentSkin !== undefined) mapped.current_skin = data.currentSkin;
  return mapped;
};

// --- LOCAL STORAGE HELPERS ---
const saveToLocal = (username: string, data: UserData) => {
  try {
    localStorage.setItem(OFFLINE_DATA_PREFIX + username, JSON.stringify(data));
  } catch (e) {
    console.warn("Local storage full or disabled");
  }
};

const getFromLocal = (username: string): UserData | null => {
  try {
    const item = localStorage.getItem(OFFLINE_DATA_PREFIX + username);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    return null;
  }
};

// --- PUBLIC API ---

export const loginUser = async (username: string): Promise<{ user: UserData | null, error: string | null, offline: boolean }> => {
  // 1. Check Local Storage first (Optimization only, NOT Authority)
  let localData = getFromLocal(username);

  try {
    // 2. Try Supabase Select
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    // CASE A: User exists in DB
    if (data && !error) {
      const dbUser = mapFromDB(data as DBUser);
      
      // SERVER AUTHORITY:
      // We explicitly ignore local data here. The DB is the Single Source of Truth.
      // This prevents a scenario where a local device reset (score 0) overwrites the server.
      // We download DB data and overwrite local cache.
      console.log("Syncing from Server...");
      saveToLocal(username, dbUser); 
      localStorage.setItem(SESSION_KEY, username);
      
      return { user: dbUser, error: null, offline: false };
    }

    // CASE B: User not found in DB (Create new)
    if (error && error.code === 'PGRST116') {
      // Only if user DOES NOT exist in DB, we look at local data to see if we should create them
      // based on a previous session, otherwise new user.
      const initialUser: UserData = localData || {
        username,
        score: 0,
        energy: MAX_ENERGY,
        lastUpdated: Date.now(),
        lastRewardTime: 0,
        ownedSkins: [0],
        currentSkin: 0
      };

      const dbInitial = mapToDB(initialUser);
      // Ensure username is set for insert
      (dbInitial as any).username = username; 

      const { error: insertError } = await supabase.from('users').insert([dbInitial]);
      
      if (!insertError) {
        saveToLocal(username, initialUser);
        localStorage.setItem(SESSION_KEY, username);
        return { user: initialUser, error: null, offline: false };
      }
      
      console.warn("DB Insert failed (RLS?), falling back to offline:", insertError.message);
    }
    
    // Generic Error Logging
    if (error && error.code !== 'PGRST116') {
      console.warn("DB Connection failed:", error.message);
    }

  } catch (e) {
    console.warn("Unexpected DB Error", e);
  }

  // 3. Fallback: Offline Mode
  // We only reach here if DB connection completely failed.
  if (localData) {
    localStorage.setItem(SESSION_KEY, username);
    return { user: localData, error: "Playing in Offline Mode", offline: true };
  }

  // Create fresh offline user
  const newLocalUser: UserData = {
    username,
    score: 0,
    energy: MAX_ENERGY,
    lastUpdated: Date.now(),
    lastRewardTime: 0,
    ownedSkins: [0],
    currentSkin: 0
  };
  
  saveToLocal(username, newLocalUser);
  localStorage.setItem(SESSION_KEY, username);
  
  return { 
    user: newLocalUser, 
    error: "Offline Mode: Progress saved locally only", 
    offline: true 
  };
};

export const getSessionUser = async (): Promise<UserData | null> => {
  const username = localStorage.getItem(SESSION_KEY);
  if (!username) return null;

  // Always return local immediately for UI speed
  const local = getFromLocal(username);
  
  // Optionally: Trigger a background re-fetch here if needed, 
  // but App.tsx handles re-syncing via updateUserProgress loop usually.
  return local;
};

export const logoutUser = () => {
  localStorage.removeItem(SESSION_KEY);
};

export const updateUserProgress = async (username: string, data: Partial<UserData>) => {
  // 1. Always update local first (for instant UI feedback and offline safety)
  const currentLocal = getFromLocal(username);
  let updatedLocal = data as UserData;

  if (currentLocal) {
    updatedLocal = { ...currentLocal, ...data, lastUpdated: Date.now() };
    saveToLocal(username, updatedLocal);
  }

  // 2. Try Supabase update
  const dbData = mapToDB({ ...data, lastUpdated: Date.now() });
  
  // We use the promise but don't await it to keep UI snappy (fire and forget)
  // However, we log errors if they happen.
  supabase
    .from('users')
    .update(dbData)
    .eq('username', username)
    .then(({ error }) => {
      if (error) {
          // If error is RLS related, we just stay silent as local storage has the data
          if (error.code !== "42501") { 
            console.warn("Cloud sync failed:", error.message);
          }
      }
    });
};

export const getLeaderboard = async (): Promise<UserData[]> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('score', { ascending: false })
      .limit(50);

    if (error || !data) {
        return [];
    }
    return (data as DBUser[]).map(mapFromDB);
  } catch (e) {
    return [];
  }
};