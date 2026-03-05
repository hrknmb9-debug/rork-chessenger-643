import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/providers/ThemeProvider';
import { useChess } from '@/providers/ChessProvider';
import { MatchCard } from '@/components/MatchCard';
import { t } from '@/utils/translations';
import { BackNavButton } from '@/components/BackNavButton';

export default function MatchNotificationsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { pendingIncoming, respondToMatch, language } = useChess();
  const router = useRouter();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const handleAccept = useCallback((matchId: string) => {
    respondToMatch(matchId, true);
  }, [respondToMatch]);

  const handleDecline = useCallback((matchId: string) => {
    respondToMatch(matchId, false);
  }, [respondToMatch]);

  const renderItem = useCallback(
    ({ item }: { item: (typeof pendingIncoming)[0] }) => (
      <View style={styles.cardWrap}>
        <MatchCard
          match={item}
          onAccept={handleAccept}
          onDecline={handleDecline}
          language={language}
        />
      </View>
    ),
    [handleAccept, handleDecline, language, styles.cardWrap]
  );

  const keyExtractor = useCallback((item: (typeof pendingIncoming)[0]) => item.id, []);

  return (
    <View style={styles.container}>
      {pendingIncoming.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>♔</Text>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            {t('incoming_requests', language)}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            {t('no_active', language)}
          </Text>
        </View>
      ) : (
        <FlatList
          data={pendingIncoming}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
        />
      )}
    </View>
  );
}

function createStyles(colors: { cardBorder: string; background: string; textPrimary: string; textMuted: string; accent: string }) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    list: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 24,
    },
    cardWrap: {
      marginBottom: 16,
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
    },
    emptyIcon: {
      fontSize: 48,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 8,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 14,
      textAlign: 'center',
    },
  });
}
