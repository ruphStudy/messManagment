import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OfflineBanner } from '@/components/offline-banner';
import { ErrorState, FullScreenLoader } from '@/components/states';
import { ToastProvider } from '@/components/toast';
import { resolveSession } from '@mess/shared';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AppThemeProvider, ThemedTree } from '@/theme/theme-provider';

function RootNavigator() {
  const { status, session, restoreError, retryRestore } = useAuth();
  // Same resolver on sign-in, restore and foreground refresh: the role/context (not the device) picks the screens.
  const mode = session ? resolveSession(session).mode : null;
  const isStudent = mode === 'STUDENT' || mode === 'UNLINKED';

  if (restoreError) {
    return <ErrorState title="Can't connect right now" description="Check your internet connection and try again." onRetry={retryRestore} />;
  }
  if (status === 'loading') return <FullScreenLoader />;

  // Protected groups: users can only reach screens that match their auth state.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Same sign-in for every role; the role (not the device) picks the screens. */}
      <Stack.Protected guard={status === 'authenticated' && isStudent}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'authenticated' && !isStudent}>
        <Stack.Screen name="team" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'guest'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <ThemedTree>
              <RootNavigator />
              <OfflineBanner />
            </ThemedTree>
          </AuthProvider>
        </ToastProvider>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}
