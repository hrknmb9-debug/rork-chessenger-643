import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { LocationProvider } from "@/providers/LocationProvider";
import { ChessProvider } from "@/providers/ChessProvider";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { ThemeProvider, useTheme } from "@/providers/ThemeProvider";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { colors } = useTheme();
  const { isLoggedIn, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === ('login' as string);

    if (!isLoggedIn && !inAuthGroup) {
      console.log('Nav: Not logged in, redirecting to login');
      router.replace('/login' as any);
      hasNavigated.current = true;
    } else if (isLoggedIn && inAuthGroup) {
      console.log('Nav: Logged in, redirecting to tabs');
      router.replace('/(tabs)' as any);
      hasNavigated.current = true;
    }
  }, [isLoggedIn, isLoading, segments]);

  const backTitle = Platform.OS === 'ios' ? ' ' : undefined;

  return (
    <Stack
      screenOptions={{
        headerBackTitle: backTitle,
        headerTintColor: colors.textPrimary,
        headerStyle: { backgroundColor: colors.background },
        gestureEnabled: true,
        animation: 'default',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="settings"
        options={{
          headerShown: true,
          presentation: "card",
          headerBackTitle: backTitle,
        }}
      />
      <Stack.Screen
        name="player/[id]"
        options={{
          headerShown: true,
          presentation: "card",
          headerBackTitle: backTitle,
        }}
      />
      <Stack.Screen
        name="login"
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="edit-profile"
        options={{
          headerShown: true,
          presentation: "modal",
          headerBackTitle: backTitle,
        }}
      />
      <Stack.Screen
        name="rate-match"
        options={{
          headerShown: true,
          presentation: "modal",
          headerBackTitle: backTitle,
        }}
      />
      <Stack.Screen
        name="chat/[id]"
        options={{
          headerShown: true,
          presentation: "card",
          headerBackTitle: backTitle,
        }}
      />
      <Stack.Screen
        name="view-rating"
        options={{
          headerShown: true,
          presentation: "modal",
          headerBackTitle: backTitle,
        }}
      />
      <Stack.Screen
        name="report-result"
        options={{
          headerShown: true,
          presentation: "modal",
          headerBackTitle: backTitle,
        }}
      />
      <Stack.Screen
        name="change-email"
        options={{
          headerShown: true,
          presentation: "card",
          headerBackTitle: backTitle,
        }}
      />
      <Stack.Screen
        name="change-password"
        options={{
          headerShown: true,
          presentation: "card",
          headerBackTitle: backTitle,
        }}
      />
      <Stack.Screen
        name="help-support"
        options={{
          headerShown: true,
          presentation: "card",
          headerBackTitle: backTitle,
        }}
      />
      <Stack.Screen
        name="terms-of-service"
        options={{
          headerShown: true,
          presentation: "card",
          headerBackTitle: backTitle,
        }}
      />
      <Stack.Screen
        name="privacy-policy"
        options={{
          headerShown: true,
          presentation: "card",
          headerBackTitle: backTitle,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView>
        <AuthProvider>
          <LocationProvider>
            <ChessProvider>
              <ThemeProvider>
                <RootLayoutNav />
              </ThemeProvider>
            </ChessProvider>
          </LocationProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
