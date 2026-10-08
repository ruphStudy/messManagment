import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { PushPlatform } from '@mess/shared';
import { api } from './api';

const TOKEN_KEY = 'mm.pushToken';

export type PushPermission = 'granted' | 'denied' | 'unavailable';

// While the app is open, show the system banner once (no duplicate in-app popup); the list/badge refresh separately.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

/**
 * Asks for permission only if the user has never been asked (a denial is respected — no repeated prompts),
 * then registers this device's Expo push token with the API. Never throws.
 */
export async function registerForPush(): Promise<PushPermission> {
  try {
    if (!Device.isDevice) return 'unavailable';
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'Mess updates', importance: Notifications.AndroidImportance.DEFAULT });
    }
    let { status, canAskAgain } = await Notifications.getPermissionsAsync();
    if (status === 'undetermined' && canAskAgain) ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return 'denied';

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return 'unavailable'; // Needs an EAS project id (see README).
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api('/push-devices/register', {
      method: 'POST',
      body: { pushToken: token, platform: Platform.OS === 'ios' ? PushPlatform.IOS : PushPlatform.ANDROID, deviceLabel: Device.modelName ?? undefined },
    });
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    return 'granted';
  } catch {
    return 'unavailable';
  }
}

/** Current OS permission, without prompting. */
export async function pushPermission(): Promise<PushPermission> {
  try {
    if (!Device.isDevice) return 'unavailable';
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

/** Called before sign-out so this phone stops receiving the previous user's notifications. Best effort. */
export async function unregisterPush() {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) return;
    await api('/push-devices/unregister', { method: 'POST', body: { pushToken: token } });
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // Signing out must never fail because of push.
  }
}
