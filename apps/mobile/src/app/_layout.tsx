import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OfflineBanner } from '@/components/offline-banner';
import { ErrorState, FullScreenLoader } from '@/components/states';
import { ToastProvider } from '@/components/toast';
import { AuthProvider, useAuth } from '@/lib/auth';

function RootNavigator() {
  const { status, restoreError, retryRestore } = useAuth();

  if (restoreError) {
    return <ErrorState title="Can't connect right now" description="Check your internet connection and try again." onRetry={retryRestore} />;
  }
  if (status === 'loading') return <FullScreenLoader />;

  // Protected groups: users can only reach screens that match their auth state.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'authenticated'}>
        <Stack.Screen name="(app)" />
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
      <ToastProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNavigator />
          <OfflineBanner />
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
