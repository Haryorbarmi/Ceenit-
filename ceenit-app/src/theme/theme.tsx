import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { darkTheme, lightTheme, Theme } from './tokens';

type Mode = 'light' | 'dark' | 'system';

type Ctx = Theme & {
  mode: Mode;
  setMode: (m: Mode) => void;
  /** Flip between light and dark from the button beside the bell. */
  toggle: () => void;
};

const KEY = 'themeMode';
const ThemeContext = createContext<Ctx>({ ...lightTheme, mode: 'system', setMode: () => undefined, toggle: () => undefined });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>('system');
  const scheme = useColorScheme();

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((v) => { if (v === 'light' || v === 'dark') setModeState(v); })
      .catch(() => undefined);
  }, []);

  // Telling iOS the choice makes the keyboard, alerts and the glass tab bar follow it too.
  useEffect(() => {
    Appearance.setColorScheme(mode === 'system' ? 'auto' : mode);
  }, [mode]);

  const isDark = mode === 'system' ? scheme === 'dark' : mode === 'dark';

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    SecureStore.setItemAsync(KEY, m).catch(() => undefined);
  }, []);
  const toggle = useCallback(() => setMode(isDark ? 'light' : 'dark'), [isDark, setMode]);

  const value = useMemo<Ctx>(() => ({ ...(isDark ? darkTheme : lightTheme), mode, setMode, toggle }), [isDark, mode, setMode, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

/**
 * Build a screen's styles from the current theme. Pass a function defined outside the component, written as
 * `const makeStyles = ({ color, tone }: Theme) => StyleSheet.create({ ... })`, so it stays stable between renders.
 */
export function useStyles<T>(make: (t: Theme) => T): T {
  const { isDark, color, tone } = useTheme();
  return useMemo(() => make({ isDark, color, tone }), [isDark, color, tone, make]);
}
