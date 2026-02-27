import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  SafeAreaView,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { 
  Settings, 
  Share, 
  Trophy, 
  Swords, 
  Calendar, 
  ExternalLink,
  ChevronRight,
  ShieldCheck
} from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useChess } from '@/providers/ChessProvider';
import { t } from '@/utils/translations';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const { user, logout } = useAuth();
  const { language } = useChess();
  const router = useRouter();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!user) return null;

  const stats = [
    { label: 'Rating', value: user.chessComRating || 1200, icon: <Trophy size={16} color={colors.accent} /> },
    { label: 'Matches', value: '24', icon: <Swords size={16} color={colors.accent} /> },
    { label: 'Joined', value: '2024', icon: <Calendar size={16} color={colors.accent} /> },
  ];

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable style={styles.headerBtn}>
            <Share size={22} color={colors.textPrimary} />
          </Pressable>
          <Pressable onPress={() => router.push('/settings' as any)} style={styles.headerBtn}>
            <Settings size={22} color={colors.textPrimary} />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileInfo}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: user.avatar || 'https://images.unsplash.com/photo-1528892952291-009c663ce843?w=400' }} style={styles.avatar} contentFit="cover" />
            <View style={styles.verifiedBadge}>
              <ShieldCheck size={14} color="#fff" />
            </View>
          </View>
          
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userHandle}>@{user.email.split('@')[0]}</Text>
          
          <View style={styles.bioContainer}>
            <Text style={styles.bioText}>
              {user.bio || 'チェス歴5年。平日の夜にオンラインで対局できる方を探しています！'}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          {stats.map((item, idx) => (
            <View key={idx} style={styles.statBox}>
              <View style={styles.statIconWrap}>{item.icon}</View>
              <Text style={styles.statValue}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actionSection}>
          <Pressable style={styles.editBtn}>
            <Text style={styles.editBtnText}>{t('edit_profile', language)}</Text>
          </Pressable>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Link Accounts</Text>
          <Pressable style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Text style={styles.menuItemText}>Chess.com</Text>
            </View>
            <View style={styles.menuItemRight}>
              <Text style={styles.linkStatus}>{user.chessComRating ? 'Connected' : 'Not Linked'}</Text>
              <ExternalLink size={16} color={colors.textMuted} />
            </View>
          </Pressable>
        </View>

        <Pressable onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>{t('logout', language)}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    safeArea: { backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingVertical: 10, gap: 16 },
    headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    scrollContent: { paddingBottom: 40 },
    profileInfo: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 20 },
    avatarContainer: { position: 'relative', marginBottom: 16 },
    avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.surface },
    verifiedBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: colors.accent, width: 28, height: 28, borderRadius: 14, borderWidth: 3, borderColor: colors.background, alignItems: 'center', justifyContent: 'center' },
    userName: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
    userHandle: { fontSize: 15, color: colors.textMuted, marginBottom: 16 },
    bioContainer: { backgroundColor: colors.surface, padding: 16, borderRadius: 16, width: '100%' },
    bioText: { fontSize: 14, color: colors.textPrimary, textAlign: 'center', lineHeight: 20 },
    statsRow: { flexDirection: 'row', paddingHorizontal: 24, marginTop: 24, gap: 12 },
    statBox: { flex: 1, backgroundColor: colors.surface, paddingVertical: 16, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
    statIconWrap: { marginBottom: 8 },
    statValue: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
    statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    actionSection: { paddingHorizontal: 24, marginTop: 24 },
    editBtn: { height: 50, borderRadius: 25, backgroundColor: colors.textPrimary, alignItems: 'center', justifyContent: 'center' },
    editBtnText: { color: colors.background, fontWeight: '700', fontSize: 16 },
    menuSection: { marginTop: 32, paddingHorizontal: 24 },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
    menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.cardBorder },
    menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    menuItemText: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
    menuItemRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    linkStatus: { fontSize: 14, color: colors.textMuted },
    logoutBtn: { marginTop: 40, paddingVertical: 12, alignItems: 'center' },
    logoutText: { color: '#FF3B30', fontWeight: '600', fontSize: 15 },
  });
}