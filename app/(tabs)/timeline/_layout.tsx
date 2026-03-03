import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { useChess } from '@/providers/ChessProvider';
import { BackNavButton } from '@/components/BackNavButton';

function BellHeaderButton() {
  const { colors } = useTheme();
  const { unreadNotificationCount } = useChess();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push('/timeline/notifications')}
      style={{ marginRight: 12, padding: 6, position: 'relative' }}
    >
      <Bell size={22} color={colors.textPrimary} />
      {unreadNotificationCount > 0 && (
        <View
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            backgroundColor: colors.red,
            borderRadius: 8,
            minWidth: 16,
            height: 16,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 4,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>
            {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export default function TimelineLayout() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerBackTitle: ' ',
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'タイムライン',
          headerRight: () => <BellHeaderButton />,
        }}
      />
      <Stack.Screen
        name="notifications"
        options={{
          title: '通知',
          headerBackTitle: ' ',
          headerLeft: () => <BackNavButton onPress={() => router.back()} />,
        }}
      />
    </Stack>
  );
}
