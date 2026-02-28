import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { SafeImage } from '@/components/SafeImage';
import { ArrowLeft, Navigation } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { ThemeColors } from '@/constants/colors';
import { useTheme } from '@/providers/ThemeProvider';
import { useChess } from '@/providers/ChessProvider';
import { useLocation } from '@/providers/LocationProvider';
import { Player } from '@/types';
import { getSkillColor, formatRating } from '@/utils/helpers';
import { t } from '@/utils/translations';

let MapView: React.ComponentType<any> | null = null;
let Marker: React.ComponentType<any> | null = null;

try {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
} catch (e) {
  console.log('react-native-maps not available');
}

const TOKYO_CENTER = {
  latitude: 35.6762,
  longitude: 139.6503,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export default function MapScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { players, language } = useChess();
  const { userLocation } = useLocation();
  const router = useRouter();

  const region = useMemo(() => {
    if (userLocation) {
      return {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      };
    }
    return TOKYO_CENTER;
  }, [userLocation]);

  const handlePlayerPress = useCallback((player: Player) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(('/player/' + player.id) as any);
  }, [router]);

  if (!MapView || !Marker) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: t('map_view', language),
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.textPrimary,
          }}
        />
        <View style={styles.fallback}>
          <Navigation size={48} color={colors.textMuted} />
          <Text style={styles.fallbackTitle}>{t('map_view', language)}</Text>
          <Text style={styles.fallbackText}>
            {t('map_mobile_only', language)}
          </Text>
          <View style={styles.playerList}>
            {players.map(player => (
              <Pressable
                key={player.id}
                onPress={() => handlePlayerPress(player)}
                style={styles.playerListItem}
              >
                <SafeImage uri={player.avatar} name={player.name} style={styles.playerAvatar} contentFit="cover" />
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{player.name}</Text>
                  <Text style={styles.playerLocation}>{player.location + ' · ' + player.distance + 'km'}</Text>
                </View>
                <View style={[styles.onlineDot, { backgroundColor: player.isOnline ? colors.green : colors.textMuted }]} />
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: t('map_view', language),
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
        }}
      />
      <MapView
        style={styles.map}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton
      >
        {players.map(player => (
          <Marker
            key={player.id}
            coordinate={{
              latitude: player.coordinates.latitude,
              longitude: player.coordinates.longitude,
            }}
            onPress={() => handlePlayerPress(player)}
          >
            <View style={styles.markerContainer}>
              <View style={[styles.markerBorder, { borderColor: getSkillColor(player.skillLevel, colors) }]}>
                <SafeImage uri={player.avatar} name={player.name} style={styles.markerAvatar} contentFit="cover" />
              </View>
              {player.isOnline && <View style={styles.markerOnline} />}
              <View style={styles.markerLabel}>
                <Text style={styles.markerName} numberOfLines={1}>{player.name}</Text>
                <Text style={styles.markerRating}>
                  {player.chessComRating !== null ? player.chessComRating : player.lichessRating !== null ? player.lichessRating : formatRating(null, language)}
                </Text>
              </View>
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    map: {
      flex: 1,
    },
    fallback: {
      flex: 1,
      alignItems: 'center',
      paddingTop: 40,
      paddingHorizontal: 20,
    },
    fallbackTitle: {
      fontSize: 20,
      fontWeight: '700' as const,
      color: colors.textPrimary,
      marginTop: 16,
      marginBottom: 8,
    },
    fallbackText: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 24,
    },
    playerList: {
      width: '100%',
      gap: 8,
    },
    playerListItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    playerAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceLight,
    },
    playerInfo: {
      flex: 1,
    },
    playerName: {
      fontSize: 15,
      fontWeight: '600' as const,
      color: colors.textPrimary,
    },
    playerLocation: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    onlineDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    markerContainer: {
      alignItems: 'center',
    },
    markerBorder: {
      borderWidth: 3,
      borderRadius: 22,
      padding: 2,
    },
    markerAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceLight,
    },
    markerOnline: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.green,
      borderWidth: 2,
      borderColor: '#fff',
    },
    markerLabel: {
      backgroundColor: colors.card,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginTop: 4,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    markerName: {
      fontSize: 10,
      fontWeight: '600' as const,
      color: colors.textPrimary,
      maxWidth: 70,
    },
    markerRating: {
      fontSize: 9,
      fontWeight: '700' as const,
      color: colors.gold,
    },
  });
}
