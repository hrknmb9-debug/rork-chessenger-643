import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Mail, Lock, User, ArrowRight, Languages } from 'lucide-react-native';
import { ThemeColors } from '@/constants/colors';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useChess } from '@/providers/ChessProvider';
import { t } from '@/utils/translations';
import { primeAudioForApp, playLoginSuccessSound } from '@/utils/messageNotificationSound';

export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { login, register } = useAuth();
  const { language, toggleLanguage } = useChess();
  const router = useRouter();
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [chessComRating, setChessComRating] = useState<string>('');
  const [lichessRating, setLichessRating] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const buttonScale = useRef(new Animated.Value(1)).current;

  const handleSubmit = useCallback(async () => {
    if (loading) return;
    await primeAudioForApp().catch(() => {});
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.sequence([
      Animated.timing(buttonScale, { toValue: 0.97, duration: 70, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(buttonScale, { toValue: 1, duration: 70, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();

    setLoading(true);
    try {
      if (isLogin) {
        const success = await login(email, password);
        if (success) {
          playLoginSuccessSound().catch(() => {});
          router.replace('/(tabs)' as any);
        }
      } else {
        const result = await register(name, email, password, {
          chessComRating: parseInt(chessComRating) || 0,
          lichessRating: parseInt(lichessRating) || 0,
          bio,
          skillLevel: 'beginner',
        });
        if (result.success) {
          playLoginSuccessSound().catch(() => {});
          router.replace('/(tabs)' as any);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [isLogin, name, email, password, chessComRating, lichessRating, bio, loading, login, register, router]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Pastel gradient backdrop */}
      <LinearGradient
        colors={['#EDE9FE', '#FAF5FF', '#FDF2F8', '#FBFBFC']}
        locations={[0, 0.35, 0.65, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Language toggle */}
          <View style={styles.topBar}>
            <Pressable onPress={toggleLanguage} style={styles.langBtn}>
              <Languages size={14} color={colors.textMuted} />
              <Text style={styles.langBtnText}>{language === 'ja' ? 'EN' : 'JA'}</Text>
            </Pressable>
          </View>

          {/* Hero */}
          <View style={styles.heroSection}>
            <LinearGradient
              colors={['#8B5CF6', '#EC4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoMark}
            >
              <Text style={styles.logoIcon}>♟</Text>
            </LinearGradient>
            <Text style={styles.appName}>Chessenger</Text>
            <Text style={styles.tagline}>{t('find_rival', language)}</Text>
          </View>

          {/* Form card */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>
              {isLogin ? t('login', language) : t('register', language)}
            </Text>

            {!isLogin && (
              <View style={styles.inputWrap}>
                <User size={16} color={colors.accent} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('name', language)}
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={setName}
                />
              </View>
            )}

            <View style={styles.inputWrap}>
              <Mail size={16} color={colors.accent} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('email', language)}
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputWrap}>
              <Lock size={16} color={colors.accent} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('password', language)}
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            {!isLogin && (
              <>
                <TextInput
                  style={[styles.inputWrap, styles.input, { paddingHorizontal: 20 }]}
                  placeholder="Chess.com Rating (optional)"
                  placeholderTextColor={colors.textMuted}
                  value={chessComRating}
                  onChangeText={setChessComRating}
                  keyboardType="number-pad"
                />
                <TextInput
                  style={[styles.inputWrap, styles.input, { paddingHorizontal: 20 }]}
                  placeholder="Lichess Rating (optional)"
                  placeholderTextColor={colors.textMuted}
                  value={lichessRating}
                  onChangeText={setLichessRating}
                  keyboardType="number-pad"
                />
                <TextInput
                  style={[styles.inputWrap, styles.input, { paddingHorizontal: 20, height: 80, textAlignVertical: 'top', paddingTop: 14 }]}
                  placeholder="Bio (optional)"
                  placeholderTextColor={colors.textMuted}
                  value={bio}
                  onChangeText={setBio}
                  multiline
                />
              </>
            )}

            <Animated.View style={{ transform: [{ scale: buttonScale }], marginTop: 8 }}>
              <Pressable onPress={handleSubmit} disabled={loading} style={styles.submitBtnWrap}>
                <LinearGradient
                  colors={['#8B5CF6', '#EC4899']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitBtn}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.submitText}>
                        {isLogin ? t('login_submit', language) : t('register_submit', language)}
                      </Text>
                      <ArrowRight size={18} color="#fff" />
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </Animated.View>
          </View>

          {/* Switch mode */}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              {isLogin ? t('no_account', language) : t('has_account', language)}
            </Text>
            <Pressable onPress={() => setIsLogin(!isLogin)}>
              <Text style={styles.switchLink}>
                {isLogin ? t('register', language) : t('login', language)}
              </Text>
            </Pressable>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  const shadow = Platform.select({
    ios: { shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24 },
    android: { elevation: 8 },
    web: { boxShadow: '0px 8px 32px rgba(139,92,246,0.12)' } as any,
  });

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#EDE9FE',
    },
    keyboardView: { flex: 1 },
    scrollContent: {
      paddingHorizontal: 24,
      paddingTop: 64,
      paddingBottom: 48,
    },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginBottom: 12,
    },
    langBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.80)',
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
        android: { elevation: 2 },
        web: { boxShadow: '0 1px 4px rgba(0,0,0,0.06)' } as any,
      }),
    },
    langBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.5,
    },
    heroSection: {
      alignItems: 'center',
      marginBottom: 36,
      marginTop: 8,
    },
    logoMark: {
      width: 88,
      height: 88,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
      ...Platform.select({
        ios: { shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 20 },
        android: { elevation: 10 },
        web: { boxShadow: '0 8px 24px rgba(139,92,246,0.35)' } as any,
      }),
    },
    logoIcon: {
      fontSize: 44,
      color: '#fff',
    },
    appName: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -1,
    },
    tagline: {
      fontSize: 15,
      color: colors.textMuted,
      marginTop: 6,
      letterSpacing: 0.2,
    },
    formCard: {
      backgroundColor: 'rgba(255,255,255,0.92)',
      borderRadius: 32,
      padding: 28,
      gap: 14,
      ...(shadow ?? {}),
    },
    formTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 4,
      letterSpacing: -0.3,
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#F8F7FF',
      borderRadius: 18,
      paddingHorizontal: 18,
      height: 54,
      ...Platform.select({
        ios: { shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
        android: { elevation: 1 },
        web: { boxShadow: '0 2px 8px rgba(139,92,246,0.06)' } as any,
      }),
    },
    inputIcon: {
      marginRight: 12,
    },
    input: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '500',
    },
    submitBtnWrap: {
      borderRadius: 28,
      overflow: 'hidden',
      ...Platform.select({
        ios: { shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16 },
        android: { elevation: 6 },
        web: { boxShadow: '0 6px 20px rgba(139,92,246,0.30)' } as any,
      }),
    },
    submitBtn: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    submitText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      marginTop: 28,
    },
    switchLabel: {
      color: colors.textMuted,
      fontSize: 14,
    },
    switchLink: {
      color: colors.accent,
      fontWeight: '700',
      fontSize: 14,
    },
  });
}
