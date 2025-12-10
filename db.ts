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
}

const mapFromDB = (data: DBUser): UserData => ({
  username: data.username,
  score: data.score,
  energy: data.energy,
  lastUpdated: data.last_updated,
  lastRewardTime: data.last_reward_time,
});

const mapToDB = (data: Partial<UserData>): Partial<DBUser> => {
  const mapped: Partial<DBUser> = {};
  if (data.username !== undefined) mapped.username = data.username;
  if (data.score !== undefined) mapped.score = data.score;
  if (data.energy !== undefined) mapped.energy = data.energy;
  if (data.lastUpdated !== undefined) mapped.last_updated = data.lastUpdated;
  if (data.lastRewardTime !== undefined) mapped.last_reward_time = data.lastRewardTime;
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
  // 1. Check Local Storage first (Optimization for offline-first feel)
  let localData = getFromLocal(username);

  try {
    // 2. Try Supabase Select
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    // If Supabase works and found user
    if (data && !error) {
      const dbUser = mapFromDB(data as DBUser);
      // Determine which is newer: DB or Local?
      // Usually DB is source of truth, but if we played offline, Local might be newer.
      // For simplicity here: DB wins on login, but we immediately sync local.
      saveToLocal(username, dbUser); 
      localStorage.setItem(SESSION_KEY, username);
      return { user: dbUser, error: null, offline: false };
    }

    // If Supabase works but user NOT found (PGRST116), try to create in DB
    if (error && error.code === 'PGRST116') {
      const newUser: DBUser = {
        username,
        score: 0,
        energy: MAX_ENERGY,
        last_updated: Date.now(),
        last_reward_time: 0
      };

      const { error: insertError } = await supabase.from('users').insert([newUser]);
      
      // If Insert succeeds
      if (!insertError) {
        saveToLocal(username, mapFromDB(newUser));
        localStorage.setItem(SESSION_KEY, username);
        return { user: mapFromDB(newUser), error: null, offline: false };
      }
      
      // If Insert fails (RLS or other), fall through to Offline mode below
      console.warn("DB Insert failed, falling back to offline:", insertError.message);
    }
    
    // If we have a generic error (Network, etc)
    if (error && error.code !== 'PGRST116') {
      console.warn("DB Connection failed:", error.message);
    }

  } catch (e) {
    console.warn("Unexpected DB Error", e);
  }

  // 3. Fallback: Offline Mode
  // If we found local data earlier, use it.
  if (localData) {
    localStorage.setItem(SESSION_KEY, username);
    return { user: localData, error: "Playing in Offline Mode", offline: true };
  }

  // If no local data and DB failed, create a fresh local user
  const newLocalUser: UserData = {
    username,
    score: 0,
    energy: MAX_ENERGY,
    lastUpdated: Date.now(),
    lastRewardTime: 0
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

  // Try local first for instant load
  const local = getFromLocal(username);
  
  // Optionally update from DB in background? 
  // For now, just return what we have.
  return local;
};

export const logoutUser = () => {
  localStorage.removeItem(SESSION_KEY);
};

export const updateUserProgress = async (username: string, data: Partial<UserData>) => {
  // 1. Always update local first
  const currentLocal = getFromLocal(username);
  if (currentLocal) {
    const updated = { ...currentLocal, ...data, lastUpdated: Date.now() };
    saveToLocal(username, updated);
  }

  // 2. Try Supabase update (Fire and forget)
  const dbData = mapToDB({ ...data, lastUpdated: Date.now() });
  
  supabase
    .from('users')
    .update(dbData)
    .eq('username', username)
    .then(({ error }) => {
      if (error) console.warn("Background sync failed:", error.message);
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