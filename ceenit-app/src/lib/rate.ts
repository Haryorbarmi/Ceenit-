import { useEffect, useState } from 'react';
import { api } from './api';
import { NGN_PER_USDT } from './format';

// Naira per USDT from the Ceenit API (Aboki Forex). Shared by every screen and refreshed at most every 30 minutes.
let current = NGN_PER_USDT;
let loadedAt = 0;
const listeners = new Set<(r: number) => void>();

async function load() {
  if (Date.now() - loadedAt < 30 * 60_000) return;
  loadedAt = Date.now();
  try {
    current = (await api.rate()).ngnPerUsdt;
    listeners.forEach((l) => l(current));
  } catch {
    loadedAt = 0; // try again next time a screen asks
  }
}

export function useRate(): number {
  const [rate, setRate] = useState(current);
  useEffect(() => {
    listeners.add(setRate);
    setRate(current);
    void load();
    return () => { listeners.delete(setRate); };
  }, []);
  return rate;
}
