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
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Send } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { ThemeColors } from '@/constants/colors';
import { useTheme } from '@/providers/ThemeProvider';
import { useChess } from '@/providers/ChessProvider';
import { Message, Player } from '@/types';
import { supabase } from '@/utils/supabaseClient';
import { t, getTimeAgo } from '@/utils/translations';

interface SupabaseMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export default function ChatScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { language, currentUserId, fetchPlayerProfile } = useChess();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [chatPlayer, setChatPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const roomId = id ?? '';

  const isNewConversation = roomId.startsWith('new_');
  const playerIdFromNew = isNewConversation ? roomId.replace('new_', '') : null;

  useEffect(() => {
    const loadChat = async () => {
      if (!roomId || !currentUserId) {
        setLoading(false);
        return;
      }

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

        const { data: messagesData, error } = await supabase
          .from('messages')
          .select('*')
          .eq('room_id', roomId)
          .order('created_at', { ascending: true });

        if (messagesData && !error) {
          const mapped: Message[] = messagesData.map((m: SupabaseMessage) => ({
            id: m.id,
            senderId: m.sender_id,
            text: m.content,
            timestamp: m.created_at,
            read: m.is_read,
          }));
          setMessages(mapped);
          console.log('Chat: Loaded', mapped.length, 'messages for room', roomId);

          await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('room_id', roomId)
            .neq('sender_id', currentUserId)
            .eq('is_read', false);
        }
      } catch (e) {
        console.log('Chat: Failed to load messages', e);
      } finally {
        setLoading(false);
      }
    };

    loadChat();
  }, [roomId, currentUserId, isNewConversation, playerIdFromNew, fetchPlayerProfile]);

  useEffect(() => {
    if (!roomId || isNewConversation) return;

    const channel = supabase
      .channel(`chat-${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomId}`,
      }, async (payload) => {
        const msg = payload.new as SupabaseMessage;
        console.log('Chat: Realtime message received', msg.id);

        const newMsg: Message = {
          id: msg.id,
          senderId: msg.sender_id,
          text: msg.content,
          timestamp: msg.created_at,
          read: msg.is_read,
        };

        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });

        if (msg.sender_id !== currentUserId) {
          await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('id', msg.id);
        }

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, currentUserId, isNewConversation]);

  const getActualRoomId = useCallback((): string => {
    if (!isNewConversation) return roomId;
    if (playerIdFromNew && currentUserId) {
      return [currentUserId, playerIdFromNew].sort().join('_');
    }
    return roomId;
  }, [roomId, isNewConversation, playerIdFromNew, currentUserId]);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !currentUserId) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const actualRoomId = getActualRoomId();
    const text = inputText.trim();
    setInputText('');

    const tempId = `msg_temp_${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      senderId: currentUserId,
      text,
      timestamp: new Date().toISOString(),
      read: true,
    };
    setMessages(prev => [...prev, tempMessage]);

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const { data, error } = await supabase.from('messages').insert({
        room_id: actualRoomId,
        sender_id: currentUserId,
        content: text,
        is_read: false,
      }).select().single();

      if (data && !error) {
        setMessages(prev =>
          prev.map(m => m.id === tempId ? { ...m, id: data.id } : m)
        );
        console.log('Chat: Message sent and synced', data.id);
      } else if (error) {
        console.log('Chat: Message send error', error.message);
      }
    } catch (e) {
      console.log('Chat: Message send failed', e);
    }
  }, [inputText, currentUserId, getActualRoomId]);

  const renderMessage = useCallback(({ item }: { item: Message }) => {
    const isMe = item.senderId === currentUserId;
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
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isMe ? styles.messageTextMe : styles.messageTextOther,
            ]}
          >
            {item.text}
          </Text>
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

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('chat', language) }} />
        <View style={styles.notFound}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      </View>
    );
  }

  if (!chatPlayer) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('chat', language) }} />
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>{t('conversation_not_found', language)}</Text>
        </View>
      </View>
    );
  }

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
                <Text style={styles.headerStatus}>
                  {chatPlayer.isOnline ? t('online', language) : chatPlayer.lastActive}
                </Text>
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
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder={t('type_message', language)}
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            testID="chat-input"
          />
          <Pressable
            onPress={handleSend}
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            disabled={!inputText.trim()}
            testID="send-button"
          >
            <Send size={18} color={inputText.trim() ? colors.white : colors.textMuted} />
          </Pressable>
        </View>
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
      color: 'rgba(255, 255, 255, 0.6)',
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
    notFound: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notFoundText: {
      fontSize: 16,
      color: colors.textMuted,
    },
  });
}
