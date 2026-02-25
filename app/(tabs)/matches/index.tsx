import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Pressable,
  Platform,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Star, Eye, FileText } from 'lucide-react-native';
import { ThemeColors } from '@/constants/colors';
import { useTheme } from '@/providers/ThemeProvider';
import { Match } from '@/types';
import { useChess } from '@/providers/ChessProvider';
import { MatchCard } from '@/components/MatchCard';
import { t } from '@/utils/translations';

type TabKey = 'active' | 'history';

export default function MatchesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { activeMatches, pendingMatches, completedMatches, respondToMatch, language } = useChess();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('active');
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleTabPress = useCallback((key: TabKey) => {
    Haptics.selectionAsync();
    setTab(key);
  }, []);

  const handleAccept = useCallback(
    (matchId: string) => {
      respondToMatch(matchId, true);
    },
    [respondToMatch]
  );

  const handleDecline = useCallback(
    (matchId: string) => {
      respondToMatch(matchId, false);
    },
    [respondToMatch]
  );

  const handleRateMatch = useCallback(
    (match: Match) => {
      if (match.status === 'completed' && !match.rating) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/rate-match?matchId=${match.id}` as any);
      }
    },
    [router]
  );

  const handleViewRating = useCallback(
    (match: Match) => {
      if (match.rating) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/view-rating?matchId=${match.id}` as any);
      }
    },
    [router]
  );

  const handleReportResult = useCallback(
    (match: Match) => {
      if (match.status === 'accepted') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/report-result?matchId=${match.id}` as any);
      }
    },
    [router]
  );

  const activeSections = useMemo(() => {
    const sections: { title: string; data: Match[] }[] = [];
    const incoming = pendingMatches.filter(m => m.isIncoming);
    const outgoing = pendingMatches.filter(m => !m.isIncoming);

    if (incoming.length > 0) {
      sections.push({ title: t('incoming_requests', language), data: incoming });
    }
    if (activeMatches.length > 0) {
      sections.push({ title: t('confirmed_matches', language), data: activeMatches });
    }
    if (outgoing.length > 0) {
      sections.push({ title: t('sent_requests', language), data: outgoing });
    }
    return sections;
  }, [activeMatches, pendingMatches, language]);

  const historySections = useMemo(() => {
    if (completedMatches.length === 0) return [];
    return [{ title: t('match_history', language), data: completedMatches }];
  }, [completedMatches, language]);

  const sections = tab === 'active' ? activeSections : historySections;

  const totalPending = pendingMatches.filter(m => m.isIncoming).length;

  const renderMatch = useCallback(
    ({ item }: { item: Match }) => (
      <View>
        <MatchCard
          match={item}
          onAccept={handleAccept}
          onDecline={handleDecline}
          onPress={handleRateMatch}
          language={language}
        />
        {item.status === 'completed' && !item.rating && (
          <Pressable
            onPress={() => handleRateMatch(item)}
            style={styles.ratePrompt}
          >
            <Star size={14} color={colors.gold} />
            <Text style={styles.ratePromptText}>{t('rate_match', language)}</Text>
          </Pressable>
        )}
        {item.status === 'completed' && item.rating && (
          <Pressable
            onPress={() => handleViewRating(item)}
            style={styles.viewRatingBtn}
          >
            <Eye size={14} color={colors.gold} />
            <Text style={styles.viewRatingText}>{t('view_rating', language)}</Text>
          </Pressable>
        )}
        {item.status === 'accepted' && (
          <Pressable
            onPress={() => handleReportResult(item)}
            style={styles.reportResultBtn}
          >
            <FileText size={14} color={colors.blue} />
            <Text style={styles.reportResultText}>{t('report_result', language)}</Text>
          </Pressable>
        )}
      </View>
    ),
    [handleAccept, handleDecline, handleRateMatch, handleViewRating, handleReportResult, language, colors, styles]
  );

  return (
    <View style={styles.container} testID="matches-screen">
      <View style={styles.tabBar}>
        <Pressable
          onPress={() => handleTabPress('active')}
          style={[styles.tab, tab === 'active' && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>
            {t('active', language)}
          </Text>
          {totalPending > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{totalPending}</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          onPress={() => handleTabPress('history')}
          style={[styles.tab, tab === 'history' && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>
            {t('history', language)}
          </Text>
        </Pressable>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        renderItem={renderMatch}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
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
            <Text style={styles.emptyIcon}>♜</Text>
            <Text style={styles.emptyTitle}>
              {tab === 'active' ? t('no_active', language) : t('no_history', language)}
            </Text>
            <Text style={styles.emptySubtitle}>
              {tab === 'active'
                ? t('find_players', language)
                : t('complete_for_history', language)}
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
    tabBar: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 16,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 4,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 10,
      gap: 6,
    },
    tabActive: {
      backgroundColor: colors.surfaceHighlight,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '500' as const,
      color: colors.textMuted,
    },
    tabTextActive: {
      color: colors.textPrimary,
      fontWeight: '600' as const,
    },
    badge: {
      backgroundColor: colors.gold,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: colors.white,
    },
    sectionHeader: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: colors.textMuted,
      marginHorizontal: 16,
      marginBottom: 10,
      marginTop: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    listContent: {
      paddingBottom: 20,
    },
    ratePrompt: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginHorizontal: 16,
      marginTop: -6,
      marginBottom: 12,
      paddingVertical: 10,
      backgroundColor: colors.goldMuted,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.goldDark,
    },
    ratePromptText: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: colors.gold,
    },
    viewRatingBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginHorizontal: 16,
      marginTop: -6,
      marginBottom: 12,
      paddingVertical: 10,
      backgroundColor: colors.goldMuted,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.gold + '40',
    },
    viewRatingText: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: colors.gold,
    },
    reportResultBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginHorizontal: 16,
      marginTop: -6,
      marginBottom: 12,
      paddingVertical: 10,
      backgroundColor: colors.blueMuted,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.blue + '40',
    },
    reportResultText: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: colors.blue,
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
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
    },
  });
}
