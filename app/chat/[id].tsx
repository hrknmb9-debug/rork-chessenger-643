import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Send, Image as ImageIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { ThemeColors } from '@/constants/colors';
import { useTheme } from '@/providers/ThemeProvider';
import { useChess } from '@/providers/ChessProvider';
import { Message, Player } from '@/types';
import { supabase } from '@/utils/supabaseClient';
import { t, getTimeAgo } from '@/utils/translations';

// ── Constants ───────────────────────────────────────────────────────────────

const IMG_PREFIX = '__IMG__';

// ── Types ───────────────────────────────────────────────────────────────────

interface SupabaseMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function isImageContent(text: string | undefined | null): boolean {
  return typeof text === 'string' && text.startsWith(IMG_PREFIX);
}

function getImageUri(text: string): string {
  return text.slice(IMG_PREFIX.length);
}

function mapRow(m: SupabaseMessage): Message {
  return {
    id: m.id,
    senderId: m.sender_id,
    text: m.content,
    timestamp: m.created_at,
    read: m.is_read,
  };
}

// ── Screen ──────────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { language, currentUserId, fetchPlayerProfile } = useChess();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);

  // Track temp IDs that are awaiting DB confirmation so realtime doesn't
  // add a duplicate entry before the insert().select() resolves.
  const pendingTempIds = useRef<Set<string>>(new Set());

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [chatPlayer, setChatPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  const roomId = id ?? '';
  const isNewConversation = roomId.startsWith('new_');
  const playerIdFromNew = isNewConversation ? roomId.replace('new_', '') : null;

  // ── Load history ───────────────────────────────────────────────────────────

  useEffect(() => {
    const loadChat = async () => {
      if (!roomId || !currentUserId) { setLoading(false); return; }

      try {
        if (isNewConversation && playerIdFromNew) {
          const player = await fetchPlayerProfile(playerIdFromNew);
          setChatPlayer(player);
          setMessages([]);
          setLoading(false);
          return;
        }

        const parts = roomId.split('_');
        const otherUserId = parts.find(p => p !== currentUserId);
        if (otherUserId) {
          const player = await fetchPlayerProfile(otherUserId);
          setChatPlayer(player);
        }

        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('room_id', roomId)
          .order('created_at', { ascending: true });

        if (data && !error) {
          setMessages(data.map(mapRow));
          console.log('Chat: Loaded', data.length, 'messages for room', roomId);

          // Mark incoming messages as read
          await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('room_id', roomId)
            .neq('sender_id', currentUserId)
            .eq('is_read', false);
        } else if (error) {
          console.log('Chat: Load error', error.message);
        }
      } catch (e) {
        console.log('Chat: Failed to load messages', e);
      } finally {
        setLoading(false);
      }
    };

    loadChat();
  }, [roomId, currentUserId, isNewConversation, playerIdFromNew, fetchPlayerProfile]);

  // ── Realtime subscription ──────────────────────────────────────────────────

  useEffect(() => {
    if (!roomId || isNewConversation) return;

    // Use a unique channel name to avoid conflicts with messages/[id].tsx
    const channelName = `chat_screen_${roomId}`;
    console.log('Chat: Subscribing to channel', channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const msg = payload.new as SupabaseMessage;
          console.log(
            'Chat: Realtime INSERT →',
            msg.id,
            '| sender:', msg.sender_id,
            '| content[:30]:', msg.content?.slice(0, 30),
            '| isImg:', msg.content?.startsWith(IMG_PREFIX),
          );

          const newMsg = mapRow(msg);

          setMessages(prev => {
            // 1. Already present by exact id
            if (prev.some(m => m.id === newMsg.id)) return prev;

            // 2. Own message: replace the temp placeholder that is still pending
            if (msg.sender_id === currentUserId && pendingTempIds.current.size > 0) {
              const tempIdx = prev.findIndex(
                m => pendingTempIds.current.has(m.id) && m.text === newMsg.text
              );
              if (tempIdx !== -1) {
                const updated = [...prev];
                const tempId = updated[tempIdx].id;
                updated[tempIdx] = { ...updated[tempIdx], id: newMsg.id };
                pendingTempIds.current.delete(tempId);
                return updated;
              }
            }

            // 3. New incoming message
            return [...prev, newMsg];
          });

          // Mark incoming messages as read immediately
          if (msg.sender_id !== currentUserId) {
            await supabase
              .from('messages')
              .update({ is_read: true })
              .eq('id', msg.id);
          }

          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        },
      )
      .subscribe((status, err) => {
        if (err) {
          console.log('Chat: Realtime subscribe ERROR', err);
        } else {
          console.log('Chat: Realtime status →', status);
        }
      });

    return () => {
      console.log('Chat: Removing channel', channelName);
      supabase.removeChannel(channel);
    };
  }, [roomId, currentUserId, isNewConversation]);

  // ── Room ID helpers ────────────────────────────────────────────────────────

  const getActualRoomId = useCallback((): string => {
    if (!isNewConversation) return roomId;
    if (playerIdFromNew && currentUserId) {
      return [currentUserId, playerIdFromNew].sort().join('_');
    }
    return roomId;
  }, [roomId, isNewConversation, playerIdFromNew, currentUserId]);

  // ── Send logic ─────────────────────────────────────────────────────────────

  const sendContent = useCallback(async (content: string) => {
    if (!currentUserId) return;
    const actualRoomId = getActualRoomId();

    const tempId = `msg_temp_${Date.now()}`;
    const tempMsg: Message = {
      id: tempId,
      senderId: currentUserId,
      text: content,
      timestamp: new Date().toISOString(),
      read: true,
    };

    pendingTempIds.current.add(tempId);
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({ room_id: actualRoomId, sender_id: currentUserId, content, is_read: false })
        .select()
        .single();

      if (data && !error) {
        // Replace temp placeholder with confirmed DB id (if not already replaced by realtime)
        pendingTempIds.current.delete(tempId);
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: data.id } : m));
      } else if (error) {
        pendingTempIds.current.delete(tempId);
        console.log('Chat: Send error', error.message);
      }
    } catch (e) {
      pendingTempIds.current.delete(tempId);
      console.log('Chat: Send failed', e);
    }
  }, [currentUserId, getActualRoomId]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || !currentUserId) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInputText('');
    await sendContent(text);
  }, [inputText, currentUserId, sendContent]);

  // ── Image picker ───────────────────────────────────────────────────────────

  const handlePickImage = useCallback(async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('アクセス許可が必要です', 'フォトライブラリへのアクセスを許可してください。');
        return;
      }
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
        aspect: [4, 3],
      });
      if (!result.canceled && result.assets[0]) {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await sendContent(`${IMG_PREFIX}${result.assets[0].uri}`);
      }
    } catch (e) {
      console.log('Chat: Image pick failed', e);
    }
  }, [sendContent]);

  // ── Render message ─────────────────────────────────────────────────────────

  const renderMessage = useCallback(({ item }: { item: Message }) => {
    const isMe = item.senderId === currentUserId;
    const isImg = isImageContent(item.text);
    const imgUri = isImg ? getImageUri(item.text) : null;

    return (
      <View
        style={[
          styles.messageBubbleRow,
          isMe ? styles.messageBubbleRowMe : styles.messageBubbleRowOther,
        ]}
      >
        {!isMe && chatPlayer && (
          <Image
            source={{ uri: chatPlayer.avatar }}
            style={styles.messageBubbleAvatar}
            contentFit="cover"
          />
        )}

        <View
          style={[
            styles.messageBubble,
            isMe ? styles.messageBubbleMe : styles.messageBubbleOther,
            isImg && styles.messageBubbleImage,
          ]}
        >
          {isImg && imgUri ? (
            <Image
              source={{ uri: imgUri }}
              style={styles.imageMessage}
              contentFit="cover"
              onError={(e) => console.log('Chat: Image render error', e.error)}
            />
          ) : (
            <Text
              style={[
                styles.messageText,
                isMe ? styles.messageTextMe : styles.messageTextOther,
              ]}
            >
              {item.text}
            </Text>
          )}

          <Text
            style={[
              styles.messageTime,
              isMe ? styles.messageTimeMe : styles.messageTimeOther,
            ]}
          >
            {getTimeAgo(item.timestamp, language)}
          </Text>
        </View>
      </View>
    );
  }, [chatPlayer, language, styles, currentUserId]);

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: '' }} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      </View>
    );
  }

  if (!chatPlayer) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: '' }} />
        <View style={styles.center}>
          <Text style={styles.notFoundText}>{t('conversation_not_found', language)}</Text>
        </View>
      </View>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
          headerTitle: () => (
            <Pressable
              onPress={() => router.push(`/player/${chatPlayer.id}` as any)}
              style={styles.headerTitle}
            >
              <Image
                source={{ uri: chatPlayer.avatar }}
                style={styles.headerAvatar}
                contentFit="cover"
              />
              <View>
                <Text style={styles.headerName}>{chatPlayer.name}</Text>
                <Text style={styles.headerStatus}>オンライン</Text>
              </View>
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[styles.notFoundText, { fontSize: 14 }]}>
                メッセージを送ってみましょう
              </Text>
            </View>
          }
        />

        <View style={styles.inputBar}>
          <Pressable
            onPress={handlePickImage}
            style={[
              styles.mediaBtn,
              { backgroundColor: colors.goldMuted, borderWidth: 1.5, borderColor: colors.gold },
            ]}
          >
            <ImageIcon size={22} color={colors.gold} />
          </Pressable>

          <TextInput
            style={styles.input}
            placeholder={t('type_message', language)}
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />

          <Pressable
            onPress={handleSend}
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            disabled={!inputText.trim()}
          >
            <Send size={18} color={inputText.trim() ? colors.white : colors.textMuted} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardView: {
      flex: 1,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    notFoundText: {
      fontSize: 16,
      color: colors.textMuted,
    },
    headerTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    headerAvatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.surfaceLight,
    },
    headerName: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: colors.textPrimary,
    },
    headerStatus: {
      fontSize: 11,
      color: colors.textMuted,
    },
    messagesList: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
    },
    messageBubbleRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
    },
    messageBubbleRowMe: {
      justifyContent: 'flex-end',
    },
    messageBubbleRowOther: {
      justifyContent: 'flex-start',
    },
    messageBubbleAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.surfaceLight,
    },
    messageBubble: {
      maxWidth: '75%',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 18,
    },
    messageBubbleImage: {
      padding: 4,
    },
    imageMessage: {
      width: 200,
      height: 150,
      borderRadius: 12,
    },
    messageBubbleMe: {
      backgroundColor: colors.gold,
      borderBottomRightRadius: 4,
    },
    messageBubbleOther: {
      backgroundColor: colors.surface,
      borderBottomLeftRadius: 4,
    },
    messageText: {
      fontSize: 15,
      lineHeight: 21,
    },
    messageTextMe: {
      color: colors.white,
    },
    messageTextOther: {
      color: colors.textPrimary,
    },
    messageTime: {
      fontSize: 10,
      marginTop: 4,
    },
    messageTimeMe: {
      color: 'rgba(255,255,255,0.6)',
      textAlign: 'right' as const,
    },
    messageTimeOther: {
      color: colors.textMuted,
    },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 10,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      backgroundColor: colors.background,
    },
    mediaBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    input: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.textPrimary,
      maxHeight: 100,
      minHeight: 40,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: {
      backgroundColor: colors.surfaceLight,
    },
  });
}
