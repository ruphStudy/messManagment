'use client';

import { useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

/** Shows a slim banner while the browser reports no network connection. */
export function ConnectivityBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div role="status" className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-ink px-4 py-2 text-sm text-white">
      <WifiOff className="size-4" aria-hidden />
      You are offline. Changes will not be saved until you reconnect.
    </div>
  );
}
