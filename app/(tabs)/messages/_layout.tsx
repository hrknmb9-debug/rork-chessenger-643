import { Stack } from 'expo-router';
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';

export default function MessagesLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '700' as const },
        contentStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: 'メッセージ' }}
      />
      <Stack.Screen
        name="[id]"
        options={{ headerShown: true }}
      />
    </Stack>
  );
}
