import * as SecureStore from 'expo-secure-store';

const REFRESH_KEY = 'mm.refreshToken';

/** Refresh token is kept in the OS keychain/keystore, never in AsyncStorage. */
export const tokenStorage = {
  get: () => SecureStore.getItemAsync(REFRESH_KEY),
  set: (token: string) => SecureStore.setItemAsync(REFRESH_KEY, token),
  clear: () => SecureStore.deleteItemAsync(REFRESH_KEY),
};
