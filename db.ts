import { UserData } from './types';
import { MAX_ENERGY } from './constants';

const DB_KEY = 'cosmic_clicker_db_v2';
const SESSION_KEY = 'cosmic_clicker_session_user';

// In-memory fallback if localStorage fails
let memoryDB: Record<string, UserData> = {};
let memorySession: string | null = null;

const isLocalStorageAvailable = () => {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
};

const hasStorage = isLocalStorageAvailable();

// Helper to get all data
const getDB = (): Record<string, UserData> => {
  if (!hasStorage) return memoryDB;
  try {
    const data = localStorage.getItem(DB_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
};

// Helper to save all data
const saveDB = (data: Record<string, UserData>) => {
  if (!hasStorage) {
    memoryDB = data;
    return;
  }
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save to localStorage', e);
  }
};

export const loginUser = (username: string): UserData => {
  const db = getDB();
  
  // Save session for auto-login
  if (hasStorage) {
    localStorage.setItem(SESSION_KEY, username);
  } else {
    memorySession = username;
  }
  
  if (db[username]) {
    return db[username];
  }

  // Create new user
  const newUser: UserData = {
    username,
    score: 0,
    energy: MAX_ENERGY,
    lastUpdated: Date.now(),
    lastRewardTime: 0
  };

  db[username] = newUser;
  saveDB(db);
  return newUser;
};

export const getSessionUser = (): UserData | null => {
  try {
    const username = hasStorage ? localStorage.getItem(SESSION_KEY) : memorySession;
    if (!username) return null;
    
    const db = getDB();
    return db[username] || null;
  } catch {
    return null;
  }
};

export const logoutUser = () => {
  if (hasStorage) {
    localStorage.removeItem(SESSION_KEY);
  } else {
    memorySession = null;
  }
};

export const updateUserProgress = (username: string, data: Partial<UserData>) => {
  const db = getDB();
  if (db[username]) {
    db[username] = { ...db[username], ...data, lastUpdated: Date.now() };
    saveDB(db);
  }
};

export const getLeaderboard = (): UserData[] => {
  const db = getDB();
  const users = Object.values(db);
  // Sort by score descending
  return users.sort((a, b) => b.score - a.score).slice(0, 50); // Top 50
};