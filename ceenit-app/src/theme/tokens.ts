// Design tokens from the Ceeneet Figma file (Design system, variables and text styles).
// Black and white lead. Purple is the secondary colour for active parts. Green means confirmed,
// red means error or expired, amber means needs attention. Status also keeps its icon and label.

export const palette = {
  black: '#000000',
  n950: '#0a0a0a',
  n900: '#171717',
  n800: '#262626',
  n700: '#404040',
  n600: '#525252',
  n500: '#737373',
  n400: '#a3a3a3',
  n300: '#d4d4d4',
  n200: '#e5e5e5',
  n100: '#f5f5f5',
  n50: '#fafafa',
  white: '#ffffff',
} as const;

export const hues = {
  purple: { 50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 900: '#2e1065' },
  green: { 50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d', 900: '#052e16' },
  red: { 50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c', 900: '#450a0a' },
  amber: { 50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309', 900: '#451a03' },
} as const;

/** Light-mode semantic colours: color/<role>/{bg,border,solid,text,on-solid} in Figma. */
function role(h: (typeof hues)[keyof typeof hues]) {
  return { bg: h[50], border: h[200], solid: h[600], text: h[700], onSolid: h[50] } as const;
}
export const tone = {
  accent: role(hues.purple),
  success: role(hues.green),
  error: role(hues.red),
  warning: role(hues.amber),
} as const;
export type ToneName = keyof typeof tone;

export const color = {
  bgPage: palette.white,
  bgSurface: palette.n50,
  bgSubtle: palette.n100,
  bgInverse: palette.black,
  textPrimary: palette.n950,
  textSecondary: palette.n600,
  textTertiary: palette.n500,
  textInverse: palette.white,
  borderDefault: palette.n200,
  borderStrong: palette.n400,
  borderInverse: palette.black,
} as const;

export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64 } as const;

export const radius = { sm: 6, md: 12, lg: 16, xl: 24, full: 9999 } as const;

// Font family names registered in src/app/_layout.tsx
export const fonts = {
  heading: 'Helvena-Bold',
  headingSemi: 'Helvena-Semibold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
} as const;

export const type = {
  display: { fontFamily: fonts.heading, fontSize: 48, lineHeight: 52, letterSpacing: -0.96 },
  h1: { fontFamily: fonts.heading, fontSize: 36, lineHeight: 40, letterSpacing: -0.54 },
  h2: { fontFamily: fonts.headingSemi, fontSize: 28, lineHeight: 34, letterSpacing: -0.28 },
  h3: { fontFamily: fonts.headingSemi, fontSize: 22, lineHeight: 28, letterSpacing: -0.11 },
  bodyLarge: { fontFamily: fonts.body, fontSize: 18, lineHeight: 28 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  bodyMedium: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 24 },
  bodySmall: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16, letterSpacing: 0.024 },
} as const;

export type TypeVariant = keyof typeof type;
