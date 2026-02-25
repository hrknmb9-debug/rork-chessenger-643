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
import * as Haptics from 'expo-haptics';
import { Mail, Lock, User, ChevronRight, Languages, Trophy } from 'lucide-react-native';
import { Image } from 'expo-image';
import { ThemeColors } from '@/constants/colors';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useChess } from '@/providers/ChessProvider';
import { t } from '@/utils/translations';

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

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  const switchMode = useCallback(() => {
    Haptics.selectionAsync();
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.5, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    setIsLogin(prev => !prev);
  }, [fadeAnim]);

  const handleSubmit = useCallback(async () => {
    if (loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.sequence([
      Animated.timing(buttonScale, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(buttonScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();

    setLoading(true);
    try {
      if (isLogin) {
        const success = await login(email, password);
        if (!success) {
          Alert.alert(t('error', language), t('login_error_desc', language));
        } else {
          router.replace('/(tabs)' as any);
        }
      } else {
        if (name.trim().length < 1) {
          Alert.alert(t('error', language), 'Username is required');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          Alert.alert(t('error', language), 'Password must be at least 6 characters');
          setLoading(false);
          return;
        }

        const parsedChessCom = chessComRating.trim() ? parseInt(chessComRating, 10) : null;
        const parsedLichess = lichessRating.trim() ? parseInt(lichessRating, 10) : null;
        const skillLevel = (() => {
          const maxRating = Math.max(parsedChessCom ?? 0, parsedLichess ?? 0);
          if (maxRating === 0) return 'beginner';
          if (maxRating < 1400) return 'beginner';
          if (maxRating < 1800) return 'intermediate';
          if (maxRating < 2100) return 'advanced';
          return 'expert';
        })();

        const result = await register(name, email, password, {
          chessComRating: parsedChessCom,
          lichessRating: parsedLichess,
          bio: bio.trim(),
          skillLevel,
        });
        if (!result.success) {
          Alert.alert(t('error', language), result.error ?? t('register_error_desc', language));
        } else {
          router.replace('/(tabs)' as any);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [isLogin, name, email, password, chessComRating, lichessRating, bio, login, register, loading, buttonScale, router, language]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heroSection}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                toggleLanguage();
              }}
              style={styles.langToggleBtn}
              testID="login-lang-toggle"
            >
              <Languages size={16} color={colors.gold} />
              <Text style={styles.langToggleText}>
                {language === 'ja' ? 'EN' : 'JA'}
              </Text>
            </Pressable>
            <Image
              source={require('@/assets/images/chessenger-logo.png')}
              style={styles.logoImage}
              contentFit="contain"
            />
            <Text style={styles.subtitle}>{t('find_rival', language)}</Text>
          </View>

          <Animated.View style={[styles.formSection, { opacity: fadeAnim }]}>
            <Text style={styles.formTitle}>
              {isLogin ? t('welcome_back', language) : t('get_started', language)}
            </Text>

            {!isLogin && (
              <View style={styles.inputContainer}>
                <User size={18} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder={t('name', language)}
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  testID="name-input"
                />
              </View>
            )}

            <View style={styles.inputContainer}>
              <Mail size={18} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder={t('email', language)}
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                testID="email-input"
              />
            </View>

            <View style={styles.inputContainer}>
              <Lock size={18} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder={t('password', language)}
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                testID="password-input"
              />
            </View>

            {!isLogin && (
              <>
                <Text style={styles.ratingsSectionTitle}>{t('online_ratings', language)}</Text>
                <View style={styles.ratingsRow}>
                  <View style={[styles.inputContainer, styles.ratingInput]}>
                    <Trophy size={16} color={colors.textMuted} />
                    <TextInput
                      style={styles.input}
                      placeholder="Chess.com"
                      placeholderTextColor={colors.textMuted}
                      value={chessComRating}
                      onChangeText={setChessComRating}
                      keyboardType="number-pad"
                      testID="chesscom-rating-input"
                    />
                  </View>
                  <View style={[styles.inputContainer, styles.ratingInput]}>
                    <Trophy size={16} color={colors.textMuted} />
                    <TextInput
                      style={styles.input}
                      placeholder="Lichess"
                      placeholderTextColor={colors.textMuted}
                      value={lichessRating}
                      onChangeText={setLichessRating}
                      keyboardType="number-pad"
                      testID="lichess-rating-input"
                    />
                  </View>
                </View>
                <Text style={styles.ratingHint}>
                  {t('rating_input_placeholder', language)} ({t('no_experience', language)})
                </Text>

                <View style={[styles.inputContainer, styles.bioInputContainer]}>
                  <TextInput
                    style={[styles.input, styles.bioInput]}
                    placeholder={t('bio_label', language)}
                    placeholderTextColor={colors.textMuted}
                    value={bio}
                    onChangeText={setBio}
                    multiline
                    numberOfLines={3}
                    testID="bio-input"
                  />
                </View>
              </>
            )}

            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <Pressable
                onPress={handleSubmit}
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                disabled={loading}
                testID="submit-button"
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Text style={styles.submitText}>
                      {isLogin ? t('login_submit', language) : t('register_submit', language)}
                    </Text>
                    <ChevronRight size={18} color={colors.white} />
                  </>
                )}
              </Pressable>
            </Animated.View>
          </Animated.View>

          <View style={styles.switchSection}>
            <Text style={styles.switchLabel}>
              {isLogin ? t('no_account', language) : t('has_account', language)}
            </Text>
            <Pressable onPress={switchMode} testID="switch-mode">
              <Text style={styles.switchLink}>
                {isLogin ? t('register', language) : t('login', language)}
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              login('guest@chess.app', 'guest123').then(success => {
                if (success) router.replace('/(tabs)' as any);
              });
            }}
            style={styles.guestButton}
            testID="guest-login"
          >
            <Text style={styles.guestText}>{t('guest_login', language)}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingVertical: 60,
    },
    heroSection: {
      alignItems: 'center',
      marginBottom: 48,
    },
    langToggleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-end',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.goldMuted,
      marginBottom: 20,
    },
    langToggleText: {
      fontSize: 13,
      fontWeight: '700' as const,
      color: colors.gold,
    },
    logoImage: {
      width: 260,
      height: 80,
      marginBottom: 12,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      fontWeight: '500' as const,
    },
    formSection: {
      gap: 14,
      marginBottom: 32,
    },
    formTitle: {
      fontSize: 20,
      fontWeight: '700' as const,
      color: colors.textPrimary,
      marginBottom: 8,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingHorizontal: 16,
      height: 54,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: colors.textPrimary,
      height: '100%',
    },
    ratingsSectionTitle: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 4,
    },
    ratingsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    ratingInput: {
      flex: 1,
    },
    ratingHint: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: -6,
    },
    bioInputContainer: {
      height: 80,
      alignItems: 'flex-start',
      paddingVertical: 12,
    },
    bioInput: {
      textAlignVertical: 'top',
    },
    submitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.gold,
      borderRadius: 14,
      height: 54,
      marginTop: 4,
    },
    submitButtonDisabled: {
      opacity: 0.7,
    },
    submitText: {
      fontSize: 17,
      fontWeight: '700' as const,
      color: colors.white,
    },
    switchSection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginBottom: 20,
    },
    switchLabel: {
      fontSize: 14,
      color: colors.textMuted,
    },
    switchLink: {
      fontSize: 14,
      fontWeight: '700' as const,
      color: colors.gold,
    },
    guestButton: {
      alignItems: 'center',
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    guestText: {
      fontSize: 15,
      fontWeight: '600' as const,
      color: colors.textSecondary,
    },
  });
}
