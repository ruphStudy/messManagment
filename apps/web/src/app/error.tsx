'use client';

import { ErrorState } from '@/components/ui/states';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center">
      <ErrorState title="Something went wrong" description="An unexpected error occurred on this page." onRetry={reset} />
    </div>
  );
}
