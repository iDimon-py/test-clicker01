import { createClient } from '@supabase/supabase-js';
import { UserData } from './types';
import { MAX_ENERGY } from './constants';

// --- CONFIGURATION ---
const SUPABASE_URL = 'https://tacmjrrbmngeyuhtvfvt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_pQna21s2Z6Dv1hTDLnfZPA_qaeTr3U9';
const SESSION_KEY = 'cosmic_clicker_session_user';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- HELPER TYPES ---
// Matches the structure in Supabase (snake_case)
interface DBUser {
  username: string;
  score: number;
  energy: number;
  last_updated: number;
  last_reward_time: number;
}

// Convert DB format (snake_case) to App format (camelCase)
const mapFromDB = (data: DBUser): UserData => ({
  username: data.username,
  score: data.score,
  energy: data.energy,
  lastUpdated: data.last_updated,
  lastRewardTime: data.last_reward_time,
});

// Convert App format to DB format
const mapToDB = (data: Partial<UserData>): Partial<DBUser> => {
  const mapped: Partial<DBUser> = {};
  if (data.username !== undefined) mapped.username = data.username;
  if (data.score !== undefined) mapped.score = data.score;
  if (data.energy !== undefined) mapped.energy = data.energy;
  if (data.lastUpdated !== undefined) mapped.last_updated = data.lastUpdated;
  if (data.lastRewardTime !== undefined) mapped.last_reward_time = data.lastRewardTime;
  return mapped;
};

// --- PUBLIC API ---

export const loginUser = async (username: string): Promise<UserData | null> => {
  try {
    // 1. Try to fetch existing user
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found"
       console.error("Error fetching user:", error);
       throw error;
    }

    // 2. If user exists, return data
    if (data) {
      localStorage.setItem(SESSION_KEY, username);
      return mapFromDB(data as DBUser);
    }

    // 3. If not, create new user
    const newUser: DBUser = {
      username,
      score: 0,
      energy: MAX_ENERGY,
      last_updated: Date.now(),
      last_reward_time: 0
    };

    const { error: insertError } = await supabase
      .from('users')
      .insert([newUser]);

    if (insertError) {
        console.error("Error creating user:", insertError);
        throw insertError;
    }

    localStorage.setItem(SESSION_KEY, username);
    return mapFromDB(newUser);

  } catch (e) {
    console.error("Login failed", e);
    return null;
  }
};

export const getSessionUser = async (): Promise<UserData | null> => {
  const username = localStorage.getItem(SESSION_KEY);
  if (!username) return null;

  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .single();

  if (data) {
      return mapFromDB(data as DBUser);
  }
  return null;
};

export const logoutUser = () => {
  localStorage.removeItem(SESSION_KEY);
};

export const updateUserProgress = async (username: string, data: Partial<UserData>) => {
  const dbData = mapToDB({ ...data, lastUpdated: Date.now() });
  
  const { error } = await supabase
    .from('users')
    .update(dbData)
    .eq('username', username);

  if (error) {
      console.error("Failed to update progress", error);
  }
};

export const getLeaderboard = async (): Promise<UserData[]> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('score', { ascending: false })
    .limit(50);

  if (error) {
      console.error("Failed to fetch leaderboard", error);
      return [];
  }

  return (data as DBUser[]).map(mapFromDB);
};