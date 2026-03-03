import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Platform, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { ThemeColors } from '@/constants/colors';
import { useTheme } from '@/providers/ThemeProvider';

type BackNavButtonProps = {
  onPress: () => void;
  /** true = floating style (e.g. over map) with stronger glass; false = inline in header */
  floating?: boolean;
};

export function BackNavButton({ onPress, floating = false }: BackNavButtonProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors, floating), [colors, floating]);

  const handlePress = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const content = (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.touchable, pressed && styles.touchablePressed]}
      hitSlop={12}
    >
      <ArrowLeft size={22} color={colors.textPrimary} strokeWidth={2.2} />
    </Pressable>
  );

  if (floating) {
    const blurContent = (
      <BlurView intensity={72} tint={colors.background === '#0B140E' ? 'dark' : 'light'} style={styles.glass}>
        {content}
      </BlurView>
    );
    return (
      <View style={styles.wrapper}>
        {Platform.OS === 'web' ? (
          <View style={[styles.glass, styles.glassFallback]}>{content}</View>
        ) : (
          blurContent
        )}
      </View>
    );
  }

  return (
    <View style={styles.inlineWrapper}>
      {Platform.OS === 'web' ? (
        <View style={[styles.glassInline, styles.glassFallbackInline]}>{content}</View>
      ) : (
        <BlurView intensity={48} tint={colors.background === '#0B140E' ? 'dark' : 'light'} style={styles.glassInline}>
          {content}
        </BlurView>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors, floating: boolean) {
  const glassBg = colors.background === '#0B140E'
    ? 'rgba(20, 30, 24, 0.75)'
    : 'rgba(255, 255, 255, 0.72)';
  const border = colors.cardBorder + '88';
  return StyleSheet.create({
    wrapper: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 56 : 48,
      left: 16,
      zIndex: 100,
      borderRadius: 14,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 4,
    },
    glass: {
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: border,
    },
    glassFallback: {
      backgroundColor: glassBg,
    },
    touchable: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    touchablePressed: {
      opacity: 0.85,
    },
    inlineWrapper: {
      marginLeft: 4,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    glassInline: {
      borderRadius: 12,
      overflow: 'hidden',
    },
    glassFallbackInline: {
      backgroundColor: glassBg,
    },
  });
}
