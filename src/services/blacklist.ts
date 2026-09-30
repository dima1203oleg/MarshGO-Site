// MARSHGO Blacklist Service
// Manages blocked users (drivers & passengers) to filter unwanted offers and protect user safety

import { BlockedUser } from '../types';

const STORAGE_KEY = 'mg_blacklist';
const BLACKLIST_EVENT = 'mg_blacklist_changed';

// Initial realistic default sample blocked users so the user sees real functionality immediately
const INITIAL_BLOCKED_USERS: BlockedUser[] = [
  {
    id: 'blocked-driver-1',
    name: 'Віктор Кравченко',
    phone: '+380 67 111 2233',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    role: 'driver',
    blockedAt: '2026-09-15T11:20:00.000Z',
    reason: 'Небезпечний стиль водіння та перевищення швидкості',
    notes: 'Ігнорував прохання зменшити швидкість на трасі Київ-Одеса'
  },
  {
    id: 'blocked-passenger-2',
    name: 'Олег Смирнов',
    phone: '+380 50 444 5566',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    role: 'passenger',
    blockedAt: '2026-09-20T14:45:00.000Z',
    reason: 'Скасування поїздки за 5 хвилин до відправлення',
    notes: 'Не з’явився на точку посадки і не відповідав на дзвінки'
  }
];

export function getBlacklist(): BlockedUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_BLOCKED_USERS));
      return INITIAL_BLOCKED_USERS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse blacklist from localStorage', e);
    return INITIAL_BLOCKED_USERS;
  }
}

export function saveBlacklist(list: BlockedUser[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(BLACKLIST_EVENT, { detail: list }));
  } catch (e) {
    console.error('Failed to save blacklist to localStorage', e);
  }
}

export function isUserInBlacklist(userId?: string, userName?: string): boolean {
  if (!userId && !userName) return false;
  const list = getBlacklist();
  return list.some(
    (b) =>
      (userId && b.id.toLowerCase() === userId.toLowerCase()) ||
      (userName && b.name.trim().toLowerCase() === userName.trim().toLowerCase())
  );
}

export function blockUser(entry: {
  id?: string;
  name: string;
  phone?: string;
  avatar?: string;
  role: 'driver' | 'passenger';
  reason: string;
  notes?: string;
}): BlockedUser {
  const list = getBlacklist();
  const id = entry.id || `blocked-${Date.now()}`;

  // If already in blacklist, update reason
  const existingIdx = list.findIndex(
    (b) => b.id === id || b.name.toLowerCase() === entry.name.toLowerCase()
  );

  const blockedItem: BlockedUser = {
    id,
    name: entry.name,
    phone: entry.phone || '',
    avatar: entry.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    role: entry.role,
    blockedAt: new Date().toISOString(),
    reason: entry.reason,
    notes: entry.notes || ''
  };

  let updatedList: BlockedUser[];
  if (existingIdx >= 0) {
    updatedList = [...list];
    updatedList[existingIdx] = blockedItem;
  } else {
    updatedList = [blockedItem, ...list];
  }

  saveBlacklist(updatedList);
  return blockedItem;
}

export function unblockUser(userId: string): void {
  const list = getBlacklist();
  const updatedList = list.filter((b) => b.id !== userId);
  saveBlacklist(updatedList);
}

export function subscribeToBlacklistChanges(callback: (list: BlockedUser[]) => void): () => void {
  const handler = (e: Event) => {
    const custom = e as CustomEvent<BlockedUser[]>;
    callback(custom.detail || getBlacklist());
  };

  window.addEventListener(BLACKLIST_EVENT, handler);
  return () => {
    window.removeEventListener(BLACKLIST_EVENT, handler);
  };
}
