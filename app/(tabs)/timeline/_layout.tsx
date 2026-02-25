import { Stack } from 'expo-router';
import { useTheme } from '@/providers/ThemeProvider';

export default function TimelineLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerBackTitle: '戻る',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'タイムライン' }} />
    </Stack>
  );
}
