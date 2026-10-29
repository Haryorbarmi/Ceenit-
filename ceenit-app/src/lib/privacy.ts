import { useCallback, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const KEY = 'hideBalance';

/** Whether the balance card shows dots instead of amounts. The choice is remembered on the phone. */
export function useHideBalance() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(KEY).then((v) => setHidden(v === '1')).catch(() => undefined);
  }, []);

  const toggle = useCallback(() => {
    setHidden((h) => {
      SecureStore.setItemAsync(KEY, h ? '0' : '1').catch(() => undefined);
      return !h;
    });
  }, []);

  return { hidden, toggle };
}
