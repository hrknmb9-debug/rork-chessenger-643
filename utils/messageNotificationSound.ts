/**
 * Plays a short, clean chime when a new message is received.
 * Web: Web Audio API (no extra dependency; respects autoplay when triggered by realtime event).
 * Native: optional expo-av can be added; without it, chime plays on web only.
 */

import { Platform } from 'react-native';

let webAudioContext: AudioContext | null = null;

function getWebAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (webAudioContext) return webAudioContext;
  try {
    webAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  } catch {
    return null;
  }
  return webAudioContext;
}

/** 初回のユーザー操作時などに呼び出して、Web Audio のコンテキストを起動しておく */
export async function primeMessageNotificationSound(): Promise<void> {
  if (Platform.OS !== 'web') return;
  const ctx = getWebAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      // ユーザー操作でない場合は失敗することがあるが、その場合は黙って無視する
    }
  }
}

/** Short chime on web via Web Audio API (880Hz sine, 0.2s). */
async function playChimeWeb(): Promise<void> {
  const ctx = getWebAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      return;
    }
  }
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // Ignore autoplay or context errors
  }
}

/** On native, try expo-av if available; otherwise no-op. */
async function playChimeNative(): Promise<void> {
  try {
    const { Audio } = await import('expo-av');
    const { sound } = await Audio.Sound.createAsync(
      { uri: 'https://assets.mixkit.co/active_storage/sfx/2869-notification-simple-chime-2869.mp3' },
      { shouldPlay: true }
    );
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinishAndNotReset) {
        sound.unloadAsync();
      }
    });
  } catch {
    // expo-av not installed or play failed
  }
}

export async function playMessageNotificationSound(): Promise<void> {
  if (Platform.OS === 'web') {
    await playChimeWeb();
    return;
  }
  await playChimeNative();
}
