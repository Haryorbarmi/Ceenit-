import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { api, Inbox } from '@/lib/api';
import { useSession } from '@/state/session';

// The bell inbox. Loaded when the app opens, when it comes back to the front, and the moment an alert arrives while it is open.

type Ctx = { inbox: Inbox; refresh: () => Promise<void>; markAllRead: () => Promise<void> };

const empty: Inbox = { unread: 0, items: [] };
const InboxContext = createContext<Ctx | null>(null);

export function InboxProvider({ children }: { children: ReactNode }) {
  const { status, me } = useSession();
  const [inbox, setInbox] = useState<Inbox>(empty);
  const active = status === 'in' && !!me;

  const refresh = useCallback(async () => {
    if (!active) return;
    try { setInbox(await api.notifications()); } catch { /* keep what we have */ }
  }, [active]);

  const markAllRead = useCallback(async () => {
    setInbox((i) => ({ unread: 0, items: i.items.map((n) => ({ ...n, read: true })) }));
    try { await api.markNotificationsRead(); } catch { /* shows as unread again next refresh */ }
  }, []);

  useEffect(() => {
    if (!active) return setInbox(empty);
    void refresh();
    const state = AppState.addEventListener('change', (s) => s === 'active' && void refresh());
    const alert = Notifications.addNotificationReceivedListener(() => void refresh());
    const timer = setInterval(() => void refresh(), 30_000);
    return () => { state.remove(); alert.remove(); clearInterval(timer); };
  }, [active, refresh]);

  const value = useMemo(() => ({ inbox, refresh, markAllRead }), [inbox, refresh, markAllRead]);
  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

export function useInbox(): Ctx {
  const c = useContext(InboxContext);
  if (!c) throw new Error('useInbox must be used inside InboxProvider');
  return c;
}
