import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as Device from 'expo-device';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { api, ApiError, Me, Method, setToken } from '@/lib/api';
import { forgetAlerts, registerForAlerts } from '@/lib/push';

// Who is signed in. The login token and the app PIN live in the phone's secure storage.
// "unlocked" is only in memory, so the PIN is asked again each time the app opens.

type Status = 'loading' | 'out' | 'in';

type Ctx = {
  status: Status;
  me: Me | null;
  unlocked: boolean;
  hasPin: boolean;
  /** Unlock with Face ID or fingerprint instead of typing the PIN. */
  biometric: boolean;
  /** Returns false if the phone did not confirm it was the owner. */
  setBiometric: (on: boolean) => Promise<boolean>;
  /** Ask for a login code. Returns the code itself only when the API is running in development. */
  requestCode: (method: Method, contact: string) => Promise<string | undefined>;
  /** Check the code. Returns true when this contact already has an account. */
  verifyCode: (method: Method, contact: string, code: string) => Promise<boolean>;
  setMe: (me: Me) => void;
  refreshMe: () => Promise<void>;
  savePin: (pin: string) => Promise<void>;
  checkPin: (pin: string) => Promise<boolean>;
  unlock: () => void;
  logout: () => Promise<void>;
};

const SessionContext = createContext<Ctx | null>(null);

const get = (k: string) => SecureStore.getItemAsync(k).catch(() => null);
const set = (k: string, v: string) => SecureStore.setItemAsync(k, v).catch(() => undefined);
const del = (k: string) => SecureStore.deleteItemAsync(k).catch(() => undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [me, setMeState] = useState<Me | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [biometric, setBiometricState] = useState(false);

  useEffect(() => {
    (async () => {
      const [token, storedPin, bio] = await Promise.all([get('token'), get('pin'), get('biometric')]);
      setPin(storedPin);
      setBiometricState(bio === '1');
      if (!token) return setStatus('out');
      setToken(token);
      try {
        setMeState(await api.me());
        setStatus('in');
      } catch (e) {
        // A token the server no longer accepts means log in again. A network failure keeps the session so the seller is not signed out by bad signal.
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          setToken(null);
          await del('token');
          setStatus('out');
        } else setStatus('in');
      }
    })();
  }, []);

  // Once signed in with an account, make sure this phone is set up to receive payment alerts.
  const hasAccount = status === 'in' && !!me;
  useEffect(() => {
    if (hasAccount) void registerForAlerts();
  }, [hasAccount]);

  const requestCode = useCallback(async (method: Method, contact: string) => (await api.requestCode(method, contact)).devCode, []);

  const verifyCode = useCallback(async (method: Method, contact: string, code: string) => {
    const r = await api.verifyCode(method, contact, code, Device.modelName ?? Device.deviceName ?? 'This phone');
    setToken(r.token);
    await set('token', r.token);
    if (r.hasAccount) {
      setMeState(await api.me());
      setStatus('in');
    }
    return r.hasAccount;
  }, []);

  const setMe = useCallback((m: Me) => {
    setMeState(m);
    setStatus('in');
  }, []);

  const refreshMe = useCallback(async () => {
    try { setMeState(await api.me()); } catch { /* keep what we have */ }
  }, []);

  const savePin = useCallback(async (p: string) => {
    await set('pin', p);
    setPin(p);
    setUnlocked(true);
  }, []);

  const checkPin = useCallback(async (p: string) => p === pin, [pin]);

  const setBiometric = useCallback(async (on: boolean) => {
    if (on) {
      const ok = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirm it is you to turn this on' });
      if (!ok.success) return false;
      await set('biometric', '1');
    } else {
      await del('biometric');
    }
    setBiometricState(on);
    return true;
  }, []);

  const logout = useCallback(async () => {
    await forgetAlerts();
    setToken(null);
    await Promise.all([del('token'), del('pin'), del('biometric')]);
    setPin(null);
    setBiometricState(false);
    setUnlocked(false);
    setMeState(null);
    setStatus('out');
  }, []);

  const value = useMemo<Ctx>(
    () => ({ status, me, unlocked, hasPin: !!pin, biometric, setBiometric, requestCode, verifyCode, setMe, refreshMe, savePin, checkPin, unlock: () => setUnlocked(true), logout }),
    [status, me, unlocked, pin, biometric, setBiometric, requestCode, verifyCode, setMe, refreshMe, savePin, checkPin, logout],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
