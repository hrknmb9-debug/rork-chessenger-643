export interface ThemeColors {
  background: string;
  surface: string;
  surfaceLight: string;
  surfaceHighlight: string;
  card: string;
  cardBorder: string;
  gold: string;       // primary accent (historically 'gold', now purple)
  goldLight: string;
  goldDark: string;
  goldMuted: string;
  white: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  green: string;
  greenMuted: string;
  red: string;
  redMuted: string;
  blue: string;
  blueMuted: string;
  orange: string;
  orangeMuted: string;
  divider: string;
  overlay: string;
  tabBar: string;
  tabBarBorder: string;
  inputBg?: string;
  accent: string;
}

export const LightTheme: ThemeColors = {
  background: '#FBFBFC',
  surface: '#FFFFFF',
  surfaceLight: '#F5F3FF',
  surfaceHighlight: '#EDE9FE',
  card: '#FFFFFF',
  cardBorder: '#E2E8F0',
  gold: '#8B5CF6',
  goldLight: '#A78BFA',
  goldDark: '#7C3AED',
  goldMuted: 'rgba(139, 92, 246, 0.09)',
  white: '#FFFFFF',
  textPrimary: '#1E293B',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  green: '#10B981',
  greenMuted: 'rgba(16, 185, 129, 0.10)',
  red: '#F43F5E',
  redMuted: 'rgba(244, 63, 94, 0.08)',
  blue: '#3B82F6',
  blueMuted: 'rgba(59, 130, 246, 0.08)',
  orange: '#F97316',
  orangeMuted: 'rgba(249, 115, 22, 0.08)',
  divider: '#F1F5F9',
  overlay: 'rgba(15, 23, 42, 0.40)',
  tabBar: '#FFFFFF',
  tabBarBorder: '#F1F5F9',
  inputBg: '#F8FAFC',
  accent: '#8B5CF6',
};

export const DarkTheme: ThemeColors = {
  background: '#0F0A1E',
  surface: '#1A1035',
  surfaceLight: '#231545',
  surfaceHighlight: '#2E1B5C',
  card: '#1A1035',
  cardBorder: '#2E1B5C',
  gold: '#A78BFA',
  goldLight: '#C4B5FD',
  goldDark: '#8B5CF6',
  goldMuted: 'rgba(167, 139, 250, 0.12)',
  white: '#F8F5FF',
  textPrimary: '#F1EFFE',
  textSecondary: '#C4B5FD',
  textMuted: '#7C6FA0',
  green: '#34D399',
  greenMuted: 'rgba(52, 211, 153, 0.12)',
  red: '#FB7185',
  redMuted: 'rgba(251, 113, 133, 0.12)',
  blue: '#60A5FA',
  blueMuted: 'rgba(96, 165, 250, 0.12)',
  orange: '#FB923C',
  orangeMuted: 'rgba(251, 146, 60, 0.12)',
  divider: '#2E1B5C',
  overlay: 'rgba(0, 0, 0, 0.65)',
  tabBar: '#0F0A1E',
  tabBarBorder: '#2E1B5C',
  inputBg: '#1A1035',
  accent: '#A78BFA',
};

const Colors = LightTheme;
export default Colors;
