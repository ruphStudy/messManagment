import Link from 'next/link';
import { UserX } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { EmptyState, ErrorState } from '@/components/ui/states';

export function StudentNotFound() {
  return (
    <EmptyState
      icon={UserX}
      title="Student not found"
      description="This student does not exist or is not part of your mess."
      action={
        <Link href="/students" className="font-semibold text-brand-700 hover:underline">
          Back to students
        </Link>
      }
    />
  );
}

export function StudentLoadError({ error, onRetry }: { error: { message: string; notFound: boolean }; onRetry: () => void }) {
  return error.notFound ? <StudentNotFound /> : <ErrorState title="Couldn't load student" description={error.message} onRetry={onRetry} />;
}

export function StudentDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-5 w-40" />
      {[0, 1].map((i) => (
        <Card key={i}>
          <Skeleton className="mb-4 h-5 w-36" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((j) => (
              <Skeleton key={j} className="h-10" />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
