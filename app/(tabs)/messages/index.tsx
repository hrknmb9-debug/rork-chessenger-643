import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Platform,
  Animated,
  PanResponder,
  Alert,
  GestureResponderEvent,
  PanResponderGestureState,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Search, MessageCircle, Trash2, BellOff, Archive } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { ThemeColors } from '@/constants/colors';
import { useTheme } from '@/providers/ThemeProvider';
import { useChess } from '@/providers/ChessProvider';
import { useAuth } from '@/providers/AuthProvider';
import { Conversation, Message, Player } from '@/types';
import { supabase } from '@/utils/supabaseClient';
import { t, getTimeAgo } from '@/utils/translations';

const SWIPE_THRESHOLD = 8;
const ACTION_WIDTH = 180;
const VELOCITY_THRESHOLD = 0.1;

interface SupabaseMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

function SwipeableConversation({
  item,
  onPress,
  onDelete,
  onMute,
  onArchive,
  language,
  colors,
  styles,
}: {
  item: Conversation;
  onPress: () => void;
  onDelete: () => void;
  onMute: () => void;
  onArchive: () => void;
  language: string;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isSwipedOpen = useRef(false);
  const startOffset = useRef(0);
  const hasMoved = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2;
        return Math.abs(gestureState.dx) > 2 && isHorizontal;
      },
      onMoveShouldSetPanResponderCapture: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
        return Math.abs(gestureState.dx) > 3 && isHorizontal;
      },
      onPanResponderGrant: () => {
        translateX.stopAnimation((value) => {
          startOffset.current = value;
        });
        hasMoved.current = false;
      },
      onPanResponderMove: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        hasMoved.current = true;
        const newValue = Math.min(0, Math.max(-ACTION_WIDTH, startOffset.current + gestureState.dx));
        translateX.setValue(newValue);
      },
      onPanResponderRelease: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        if (!hasMoved.current) return;

        const shouldOpen = !isSwipedOpen.current && (gestureState.dx < -SWIPE_THRESHOLD || gestureState.vx < -VELOCITY_THRESHOLD);
        const shouldClose = isSwipedOpen.current && (gestureState.dx > SWIPE_THRESHOLD || gestureState.vx > VELOCITY_THRESHOLD);

        if (shouldOpen) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          Animated.spring(translateX, {
            toValue: -ACTION_WIDTH,
            useNativeDriver: true,
            tension: 120,
            friction: 14,
          }).start();
          isSwipedOpen.current = true;
        } else if (shouldClose) {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 120,
            friction: 14,
          }).start();
          isSwipedOpen.current = false;
        } else {
          const target = isSwipedOpen.current ? -ACTION_WIDTH : 0;
          Animated.spring(translateX, {
            toValue: target,
            useNativeDriver: true,
            tension: 100,
            friction: 14,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        const target = isSwipedOpen.current ? -ACTION_WIDTH : 0;
        Animated.spring(translateX, {
          toValue: target,
          useNativeDriver: true,
          tension: 100,
          friction: 14,
        }).start();
      },
    })
  ).current;

  const closeSwipe = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
    isSwipedOpen.current = false;
  }, [translateX]);

  const handleDelete = useCallback(() => {
    closeSwipe();
    onDelete();
  }, [closeSwipe, onDelete]);

  const handleMute = useCallback(() => {
    closeSwipe();
    onMute();
  }, [closeSwipe, onMute]);

  const handleArchive = useCallback(() => {
    closeSwipe();
    onArchive();
  }, [closeSwipe, onArchive]);

  const handleItemPress = useCallback(() => {
    if (isSwipedOpen.current) {
      closeSwipe();
    } else {
      onPress();
    }
  }, [closeSwipe, onPress]);

  const isUnread = item.unreadCount > 0;
  const timeAgo = getTimeAgo(item.lastMessage.timestamp, language);
  const { currentUserId } = useChess();
  const isFromMe = item.lastMessage.senderId === currentUserId || item.lastMessage.senderId === 'me';

  return (
    <View style={styles.swipeableContainer}>
      <View style={styles.actionsContainer}>
        <Pressable onPress={handleArchive} style={styles.actionArchive} testID={`archive-${item.id}`}>
          <Archive size={18} color={colors.white} />
          <Text style={styles.actionLabel}>{t('archive_conversation', language)}</Text>
        </Pressable>
        <Pressable onPress={handleMute} style={styles.actionMute} testID={`mute-${item.id}`}>
          <BellOff size={18} color={colors.white} />
          <Text style={styles.actionLabel}>{t('mute_conversation', language)}</Text>
        </Pressable>
        <Pressable onPress={handleDelete} style={styles.actionDelete} testID={`delete-${item.id}`}>
          <Trash2 size={18} color={colors.white} />
          <Text style={styles.actionLabel}>{t('delete_conversation', language)}</Text>
        </Pressable>
      </View>

      <Animated.View
        style={[styles.swipeableForeground, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <Pressable
          onPress={handleItemPress}
          style={({ pressed }) => [
            styles.conversationItem,
            pressed && !isSwipedOpen.current && styles.conversationPressed,
            isUnread && styles.conversationUnread,
          ]}
          testID={`conversation-${item.id}`}
        >
          <View style={styles.avatarContainer}>
            <Image source={{ uri: item.player.avatar }} style={styles.avatar} contentFit="cover" />
            {item.player.isOnline && <View style={styles.onlineDot} />}
          </View>

          <View style={styles.conversationContent}>
            <View style={styles.conversationHeader}>
              <Text style={[styles.playerName, isUnread && styles.playerNameUnread]} numberOfLines={1}>
                {item.player.name}
              </Text>
              <Text style={[styles.timestamp, isUnread && styles.timestampUnread]}>
                {timeAgo}
              </Text>
            </View>
            <View style={styles.messagePreview}>
              <Text
                style={[styles.lastMessage, isUnread && styles.lastMessageUnread]}
                numberOfLines={1}
              >
                {isFromMe ? t('from_me', language) : ''}{item.lastMessage.text}
              </Text>
              {isUnread && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadCount}>{item.unreadCount}</Text>
                </View>
              )}
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function getRoomId(userId1: string, userId2: string): string {
  return [userId1, userId2].sort().join('_');
}

export default function MessagesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { language, currentUserId, fetchPlayerProfile, blockedUsers } = useChess();
  const { isLoggedIn } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadConversations = useCallback(async () => {
    if (!currentUserId || currentUserId === 'me') {
      setLoading(false);
      return;
    }

    try {
      console.log('Messages: Loading conversations from Supabase for', currentUserId);

      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${currentUserId},room_id.ilike.%${currentUserId}%`)
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Messages: Error loading messages', error.message);
        setLoading(false);
        return;
      }

      if (!messagesData || messagesData.length === 0) {
        console.log('Messages: No messages found');
        setConversations([]);
        setLoading(false);
        return;
      }

      const roomMap = new Map<string, SupabaseMessage[]>();
      messagesData.forEach((msg: SupabaseMessage) => {
        const existing = roomMap.get(msg.room_id) ?? [];
        existing.push(msg);
        roomMap.set(msg.room_id, existing);
      });

      const convs: Conversation[] = [];

      for (const [roomId, msgs] of roomMap.entries()) {
        const parts = roomId.split('_');
        const otherUserId = parts.find(p => p !== currentUserId);
        if (!otherUserId) continue;

        if (blockedUsers.includes(otherUserId)) continue;

        const player = await fetchPlayerProfile(otherUserId);
        if (!player) continue;

        const sorted = msgs.sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        const messages: Message[] = sorted.map(m => ({
          id: m.id,
          senderId: m.sender_id,
          text: m.content,
          timestamp: m.created_at,
          read: m.is_read,
        }));

        const lastMsg = sorted[sorted.length - 1];
        const unreadCount = sorted.filter(m =>
          m.sender_id !== currentUserId && !m.is_read
        ).length;

        convs.push({
          id: roomId,
          player,
          lastMessage: {
            id: lastMsg.id,
            senderId: lastMsg.sender_id,
            text: lastMsg.content,
            timestamp: lastMsg.created_at,
            read: lastMsg.is_read,
          },
          messages,
          unreadCount,
        });
      }

      convs.sort((a, b) =>
        new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime()
      );

      setConversations(convs);
      console.log('Messages: Loaded', convs.length, 'conversations');
    } catch (e) {
      console.log('Messages: Failed to load conversations', e);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, fetchPlayerProfile, blockedUsers]);

  useEffect(() => {
    if (isLoggedIn && currentUserId && currentUserId !== 'me') {
      loadConversations();
    } else {
      setLoading(false);
    }
  }, [isLoggedIn, currentUserId, loadConversations]);

  useEffect(() => {
    if (!currentUserId || currentUserId === 'me') return;

    const channel = supabase
      .channel('messages-list-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        const msg = payload.new as SupabaseMessage;
        if (msg.sender_id === currentUserId || msg.room_id.includes(currentUserId)) {
          console.log('Messages: Realtime new message in room', msg.room_id);
          loadConversations();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, loadConversations]);

  const markConversationRead = useCallback(async (roomId: string) => {
    setConversations(prev =>
      prev.map(c => {
        if (c.id !== roomId) return c;
        return {
          ...c,
          unreadCount: 0,
          lastMessage: { ...c.lastMessage, read: true },
          messages: c.messages.map(m => ({ ...m, read: true })),
        };
      })
    );

    try {
      if (currentUserId && currentUserId !== 'me') {
        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('room_id', roomId)
          .neq('sender_id', currentUserId)
          .eq('is_read', false);
        console.log('Messages: Marked as read in Supabase for room', roomId);
      }
    } catch (e) {
      console.log('Messages: Failed to mark as read in Supabase', e);
    }
  }, [currentUserId]);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(c =>
      c.player.name.toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations]
  );

  const handleConversationPress = useCallback((conv: Conversation) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    markConversationRead(conv.id);
    router.push(`/chat/${conv.id}` as any);
  }, [router, markConversationRead]);

  const handleDelete = useCallback((convId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    Alert.alert(
      t('delete_conversation', language),
      '',
      [
        { text: t('cancel', language), style: 'cancel' },
        {
          text: t('delete_conversation', language),
          style: 'destructive',
          onPress: () => {
            setConversations(prev => prev.filter(c => c.id !== convId));
            console.log('Conversation deleted:', convId);
          },
        },
      ]
    );
  }, [language]);

  const handleMute = useCallback((convId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    Alert.alert(t('conversation_muted', language));
    console.log('Conversation muted:', convId);
  }, [language]);

  const handleArchive = useCallback((convId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setConversations(prev => prev.filter(c => c.id !== convId));
    Alert.alert(t('conversation_archived', language));
    console.log('Conversation archived:', convId);
  }, [language]);

  const handleLoginPress = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push('/login' as any);
  }, [router]);

  const renderConversation = useCallback(({ item }: { item: Conversation }) => {
    return (
      <SwipeableConversation
        item={item}
        onPress={() => handleConversationPress(item)}
        onDelete={() => handleDelete(item.id)}
        onMute={() => handleMute(item.id)}
        onArchive={() => handleArchive(item.id)}
        language={language}
        colors={colors}
        styles={styles}
      />
    );
  }, [handleConversationPress, handleDelete, handleMute, handleArchive, language, colors, styles]);

  if (!isLoggedIn) {
    return (
      <View style={styles.container} testID="messages-screen">
        <View style={styles.loginPrompt}>
          <View style={styles.loginIconContainer}>
            <MessageCircle size={48} color={colors.gold} />
          </View>
          <Text style={styles.loginTitle}>{t('messages', language)}</Text>
          <Text style={styles.loginSubtitle}>
            {t('login_prompt_desc', language)}
          </Text>
          <Pressable onPress={handleLoginPress} style={styles.loginButton}>
            <Text style={styles.loginButtonText}>{t('login', language)}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="messages-screen">
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Search size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('search_conversations', language)}
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            testID="message-search"
          />
        </View>
        {totalUnread > 0 && (
          <View style={styles.totalUnreadBadge}>
            <Text style={styles.totalUnreadText}>{totalUnread}{t('unread_count', language)}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          renderItem={renderConversation}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MessageCircle size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>{t('no_messages', language)}</Text>
              <Text style={styles.emptySubtitle}>{t('start_chatting', language)}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
      gap: 10,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      height: 42,
      gap: 10,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.textPrimary,
      height: '100%',
    },
    totalUnreadBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.goldMuted,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 10,
    },
    totalUnreadText: {
      fontSize: 12,
      fontWeight: '600' as const,
      color: colors.gold,
    },
    listContent: {
      paddingBottom: 20,
    },
    swipeableContainer: {
      overflow: 'hidden',
    },
    actionsContainer: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: ACTION_WIDTH,
      flexDirection: 'row',
    },
    actionArchive: {
      flex: 1,
      backgroundColor: colors.blue,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
    },
    actionMute: {
      flex: 1,
      backgroundColor: colors.orange,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
    },
    actionDelete: {
      flex: 1,
      backgroundColor: colors.red,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
    },
    actionLabel: {
      fontSize: 9,
      fontWeight: '600' as const,
      color: colors.white,
      textAlign: 'center',
    },
    swipeableForeground: {
      backgroundColor: colors.background,
    },
    conversationItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      backgroundColor: colors.background,
    },
    conversationPressed: {
      backgroundColor: colors.surface,
    },
    conversationUnread: {
      backgroundColor: colors.goldMuted,
    },
    avatarContainer: {
      position: 'relative',
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.surfaceLight,
    },
    onlineDot: {
      position: 'absolute',
      bottom: 1,
      right: 1,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: colors.green,
      borderWidth: 2.5,
      borderColor: colors.background,
    },
    conversationContent: {
      flex: 1,
      gap: 4,
    },
    conversationHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    playerName: {
      fontSize: 16,
      fontWeight: '500' as const,
      color: colors.textPrimary,
      flex: 1,
    },
    playerNameUnread: {
      fontWeight: '700' as const,
    },
    timestamp: {
      fontSize: 12,
      color: colors.textMuted,
      marginLeft: 8,
    },
    timestampUnread: {
      color: colors.gold,
      fontWeight: '600' as const,
    },
    messagePreview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    lastMessage: {
      flex: 1,
      fontSize: 14,
      color: colors.textMuted,
    },
    lastMessageUnread: {
      color: colors.textSecondary,
      fontWeight: '500' as const,
    },
    unreadBadge: {
      backgroundColor: colors.gold,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    unreadCount: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: colors.white,
    },
    loginPrompt: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
    },
    loginIconContainer: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.goldMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    loginTitle: {
      fontSize: 22,
      fontWeight: '700' as const,
      color: colors.textPrimary,
      marginBottom: 8,
    },
    loginSubtitle: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 28,
      lineHeight: 22,
    },
    loginButton: {
      backgroundColor: colors.gold,
      paddingHorizontal: 36,
      paddingVertical: 14,
      borderRadius: 14,
    },
    loginButtonText: {
      fontSize: 16,
      fontWeight: '700' as const,
      color: colors.white,
    },
    emptyState: {
      alignItems: 'center',
      paddingTop: 80,
      paddingHorizontal: 40,
      gap: 12,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600' as const,
      color: colors.textPrimary,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
    },
  });
}
