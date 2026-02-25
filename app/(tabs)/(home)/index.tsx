import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Platform,
  ActivityIndicator,
  Animated,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Search, MapPin, Navigation, Languages, Map, LogIn, Compass, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { ThemeColors } from '@/constants/colors';
import { useTheme } from '@/providers/ThemeProvider';
import { Player, SkillLevel } from '@/types';
import { useChess } from '@/providers/ChessProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useLocation } from '@/providers/LocationProvider';
import { PlayerCard } from '@/components/PlayerCard';
import { t } from '@/utils/translations';
import { formatDistance } from '@/utils/helpers';

const FILTERS: { key: SkillLevel | 'all'; labelKey: string }[] = [
  { key: 'all', labelKey: 'all' },
  { key: 'beginner', labelKey: 'beginner' },
  { key: 'intermediate', labelKey: 'intermediate' },
  { key: 'advanced', labelKey: 'advanced' },
  { key: 'expert', labelKey: 'expert' },
];

const RADIUS_OPTIONS = [1, 3, 5, 10, 25, 50];

export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { players, nearbyPlayers, language, toggleLanguage, refreshPlayers } = useChess();
  const { isLoggedIn } = useAuth();
  const { userLocation, isLoading: locationLoading, requestLocation, permissionDenied, locationEnabled, toggleLocationEnabled } = useLocation();
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<SkillLevel | 'all'>('all');
  const [showOnlineOnly, setShowOnlineOnly] = useState<boolean>(false);
  const [searchRadius, setSearchRadius] = useState<number>(5);
  const [showRadiusSelector, setShowRadiusSelector] = useState<boolean>(false);

  const loginBannerAnim = useRef(new Animated.Value(1)).current;

  const filteredPlayers = useMemo(() => {
    let result = [...players];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        p => p.name.toLowerCase().includes(q) || p.location.toLowerCase().includes(q)
      );
    }
    if (activeFilter !== 'all') {
      result = result.filter(p => p.skillLevel === activeFilter);
    }
    if (showOnlineOnly) {
      result = result.filter(p => p.isOnline);
    }
    if (userLocation) {
      result = result.filter(p => p.distance <= searchRadius);
    }
    return result.sort((a, b) => a.distance - b.distance);
  }, [players, searchQuery, activeFilter, showOnlineOnly, userLocation, searchRadius]);

  const handlePlayerPress = useCallback(
    (player: Player) => {
      router.push(`/player/${player.id}` as any);
    },
    [router]
  );

  const handleFilterPress = useCallback(
    (key: SkillLevel | 'all') => {
      if (Platform.OS !== 'web') {
        Haptics.selectionAsync();
      }
      setActiveFilter(key);
    },
    []
  );

  const toggleOnline = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setShowOnlineOnly(prev => !prev);
  }, []);

  const handleTranslatePress = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    toggleLanguage();
  }, [toggleLanguage]);

  const handleLocationPress = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    toggleLocationEnabled();
  }, [toggleLocationEnabled]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (locationEnabled) {
      await requestLocation();
    }
    await refreshPlayers();
    setTimeout(() => setRefreshing(false), 800);
  }, [locationEnabled, requestLocation, refreshPlayers]);

  const handleMapPress = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push('/(tabs)/(home)/map' as any);
  }, [router]);

  const handleLoginPress = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push('/login' as any);
  }, [router]);

  const handleRadiusChange = useCallback((radius: number) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setSearchRadius(radius);
    setShowRadiusSelector(false);
  }, []);

  const toggleRadiusSelector = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setShowRadiusSelector(prev => !prev);
  }, []);

  const renderPlayer = useCallback(
    ({ item }: { item: Player }) => (
      <PlayerCard player={item} onPress={handlePlayerPress} language={language} />
    ),
    [handlePlayerPress, language]
  );

  const keyExtractor = useCallback((item: Player) => item.id, []);

  const onlinePlayers = useMemo(
    () => players.filter(p => p.isOnline).length,
    [players]
  );

  const nearbyCount = useMemo(
    () => userLocation ? players.filter(p => p.distance <= searchRadius).length : 0,
    [players, userLocation, searchRadius]
  );

  const ListHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        {!isLoggedIn && (
          <Pressable
            onPress={handleLoginPress}
            style={styles.loginBanner}
            testID="login-banner"
          >
            <View style={styles.loginBannerLeft}>
              <View style={styles.loginBannerIcon}>
                <LogIn size={18} color={colors.gold} />
              </View>
              <View style={styles.loginBannerTextGroup}>
                <Text style={styles.loginBannerTitle}>
                  {t('login_prompt', language)}
                </Text>
                <Text style={styles.loginBannerSubtitle}>
                  {t('login_prompt_desc', language)}
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.gold} />
          </Pressable>
        )}

        <View style={styles.locationBar}>
          <Pressable
            onPress={handleLocationPress}
            style={[
              styles.locationChip,
              userLocation ? styles.locationChipActive : undefined,
            ]}
            testID="location-toggle"
          >
            {locationLoading ? (
              <ActivityIndicator size="small" color={colors.blue} />
            ) : (
              <Navigation
                size={14}
                color={userLocation ? colors.blue : colors.textMuted}
              />
            )}
            <Text
              style={[
                styles.locationText,
                userLocation ? styles.locationTextActive : undefined,
              ]}
            >
              {locationLoading
                ? t('location_loading', language)
                : userLocation
                ? t('location_enabled', language)
                : permissionDenied
                ? t('location_off', language)
                : t('location_off', language)}
            </Text>
            {userLocation && (
              <View style={styles.locationLiveDot} />
            )}
          </Pressable>

          <Pressable
            onPress={handleMapPress}
            style={styles.mapChip}
            testID="map-toggle"
          >
            <Map size={14} color={colors.blue} />
          </Pressable>

          <Pressable
            onPress={handleTranslatePress}
            style={[
              styles.translateChip,
              language === 'en' ? styles.translateChipActive : undefined,
            ]}
            testID="translate-toggle"
          >
            <Languages size={14} color={language === 'en' ? colors.gold : colors.textMuted} />
            <Text
              style={[
                styles.translateText,
                language === 'en' ? styles.translateTextActive : undefined,
              ]}
            >
              {language === 'ja' ? 'EN' : 'JA'}
            </Text>
          </Pressable>
        </View>

        {userLocation && (
          <View style={styles.explorerSection}>
            <View style={styles.explorerHeader}>
              <Compass size={16} color={colors.blue} />
              <Text style={styles.explorerTitle}>{t('explore_nearby', language)}</Text>
            </View>

            <Pressable onPress={toggleRadiusSelector} style={styles.radiusDisplay}>
              <Text style={styles.radiusLabel}>{t('search_radius', language)}</Text>
              <View style={styles.radiusValue}>
                <Text style={styles.radiusNumber}>{searchRadius}</Text>
                <Text style={styles.radiusUnit}>{t('within_km', language)}</Text>
              </View>
              <Text style={styles.radiusPlayerCount}>
                {nearbyCount}{t('players_count', language)}
              </Text>
            </Pressable>

            {showRadiusSelector && (
              <View style={styles.radiusOptions}>
                {RADIUS_OPTIONS.map(r => (
                  <Pressable
                    key={r}
                    onPress={() => handleRadiusChange(r)}
                    style={[
                      styles.radiusOption,
                      searchRadius === r && styles.radiusOptionActive,
                    ]}
                  >
                    <Text style={[
                      styles.radiusOptionText,
                      searchRadius === r && styles.radiusOptionTextActive,
                    ]}>
                      {r}km
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            <View style={styles.radiusBar}>
              <View
                style={[
                  styles.radiusBarFill,
                  { width: `${Math.min((searchRadius / 25) * 100, 100)}%` },
                ]}
              />
            </View>
          </View>
        )}

        <View style={styles.searchContainer}>
          <Search size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('search_placeholder', language)}
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            testID="search-input"
          />
          <Pressable
            onPress={toggleOnline}
            style={[styles.onlineToggle, showOnlineOnly && styles.onlineToggleActive]}
            testID="online-toggle"
          >
            <View style={[styles.onlineDot, showOnlineOnly && styles.onlineDotActive]} />
            <Text
              style={[styles.onlineText, showOnlineOnly && styles.onlineTextActive]}
            >
              {onlinePlayers}
            </Text>
          </Pressable>
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={item => item.key}
          contentContainerStyle={styles.filtersContainer}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleFilterPress(item.key)}
              style={[
                styles.filterChip,
                activeFilter === item.key && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  activeFilter === item.key && styles.filterTextActive,
                ]}
              >
                {t(item.labelKey, language)}
              </Text>
            </Pressable>
          )}
        />

        <View style={styles.resultRow}>
          <Text style={styles.resultCount}>
            {filteredPlayers.length}{t('players_count', language)}
          </Text>
          {userLocation && (
            <View style={styles.sortIndicator}>
              <MapPin size={11} color={colors.blue} />
              <Text style={styles.sortText}>{t('nearby', language)}</Text>
            </View>
          )}
        </View>
      </View>
    ),
    [searchQuery, activeFilter, showOnlineOnly, onlinePlayers, filteredPlayers.length, handleFilterPress, toggleOnline, userLocation, locationLoading, permissionDenied, language, handleTranslatePress, handleLocationPress, isLoggedIn, handleLoginPress, handleMapPress, searchRadius, showRadiusSelector, toggleRadiusSelector, handleRadiusChange, nearbyCount, colors, styles]
  );

  return (
    <View style={styles.container} testID="home-screen">
      <FlatList
        data={filteredPlayers}
        renderItem={renderPlayer}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
            colors={[colors.gold]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>♟</Text>
            <Text style={styles.emptyTitle}>
              {userLocation ? t('no_nearby', language) : t('no_players', language)}
            </Text>
            <Text style={styles.emptySubtitle}>
              {userLocation ? t('expand_radius', language) : t('change_filters', language)}
            </Text>
          </View>
        }
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    listContent: {
      paddingBottom: 20,
    },
    listHeader: {
      paddingTop: 8,
      marginBottom: 4,
    },
    loginBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginHorizontal: 16,
      marginBottom: 12,
      padding: 14,
      borderRadius: 14,
      backgroundColor: colors.goldMuted,
      borderWidth: 1,
      borderColor: colors.goldDark + '40',
    },
    loginBannerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    loginBannerIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.goldMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loginBannerTextGroup: {
      flex: 1,
    },
    loginBannerTitle: {
      fontSize: 14,
      fontWeight: '700' as const,
      color: colors.gold,
      marginBottom: 2,
    },
    loginBannerSubtitle: {
      fontSize: 12,
      color: colors.goldLight,
    },
    locationBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginBottom: 10,
    },
    locationChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    locationChipActive: {
      borderColor: colors.blue + '4D',
      backgroundColor: colors.blueMuted,
    },
    locationText: {
      fontSize: 12,
      fontWeight: '500' as const,
      color: colors.textMuted,
    },
    locationTextActive: {
      color: colors.blue,
    },
    locationLiveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.blue,
    },
    mapChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.blueMuted,
      borderWidth: 1,
      borderColor: colors.blue + '4D',
    },
    translateChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    translateChipActive: {
      borderColor: colors.gold + '4D',
      backgroundColor: colors.goldMuted,
    },
    translateText: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: colors.textMuted,
    },
    translateTextActive: {
      color: colors.gold,
    },
    explorerSection: {
      marginHorizontal: 16,
      marginBottom: 12,
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.blue + '26',
    },
    explorerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    explorerTitle: {
      fontSize: 14,
      fontWeight: '600' as const,
      color: colors.blue,
    },
    radiusDisplay: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    radiusLabel: {
      fontSize: 12,
      color: colors.textMuted,
    },
    radiusValue: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 2,
      backgroundColor: colors.blueMuted,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    radiusNumber: {
      fontSize: 16,
      fontWeight: '700' as const,
      color: colors.blue,
    },
    radiusUnit: {
      fontSize: 11,
      color: colors.blue,
      fontWeight: '500' as const,
    },
    radiusPlayerCount: {
      fontSize: 12,
      color: colors.textSecondary,
      marginLeft: 'auto',
    },
    radiusOptions: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
    },
    radiusOption: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.surfaceLight,
      alignItems: 'center',
    },
    radiusOptionActive: {
      backgroundColor: colors.blueMuted,
      borderWidth: 1,
      borderColor: colors.blue + '66',
    },
    radiusOptionText: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: colors.textMuted,
    },
    radiusOptionTextActive: {
      color: colors.blue,
    },
    radiusBar: {
      height: 4,
      backgroundColor: colors.surfaceLight,
      borderRadius: 2,
      overflow: 'hidden',
    },
    radiusBarFill: {
      height: '100%',
      backgroundColor: colors.blue,
      borderRadius: 2,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      marginHorizontal: 16,
      paddingHorizontal: 14,
      height: 46,
      gap: 10,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.textPrimary,
      height: '100%',
    },
    onlineToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.surfaceLight,
    },
    onlineToggleActive: {
      backgroundColor: colors.greenMuted,
    },
    onlineDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.textMuted,
    },
    onlineDotActive: {
      backgroundColor: colors.green,
    },
    onlineText: {
      fontSize: 12,
      fontWeight: '600' as const,
      color: colors.textMuted,
    },
    onlineTextActive: {
      color: colors.green,
    },
    filtersContainer: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 8,
    },
    filterChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    filterChipActive: {
      backgroundColor: colors.goldMuted,
      borderColor: colors.goldDark,
    },
    filterText: {
      fontSize: 13,
      fontWeight: '500' as const,
      color: colors.textSecondary,
    },
    filterTextActive: {
      color: colors.gold,
      fontWeight: '600' as const,
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginHorizontal: 16,
      marginBottom: 12,
    },
    resultCount: {
      fontSize: 13,
      color: colors.textMuted,
    },
    sortIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    sortText: {
      fontSize: 11,
      color: colors.blue,
      fontWeight: '500' as const,
    },
    emptyState: {
      alignItems: 'center',
      paddingTop: 80,
      paddingHorizontal: 40,
    },
    emptyIcon: {
      fontSize: 48,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600' as const,
      color: colors.textPrimary,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
    },
  });
}
