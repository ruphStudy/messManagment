import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { EmptyState } from '@/components/ui/states';

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <EmptyState
        icon={SearchX}
        title="Page not found"
        description="The page you are looking for does not exist."
        action={
          <Link href="/" className="font-semibold text-brand-700 hover:underline">
            Go to home
          </Link>
        }
      />
    </div>
  );
}
