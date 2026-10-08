import type { ReminderResult } from '@mess/shared';
import { Alert } from '@/components/ui/alert';

/** Sent / skipped / failed summary after sending reminders. */
export function ReminderResultSummary({ result }: { result: ReminderResult }) {
  const problems = [...result.skipped, ...result.failed];
  return (
    <Alert tone={result.sent.length ? 'success' : 'info'}>
      <p className="font-semibold">
        {result.sent.length} sent{result.skipped.length ? ` · ${result.skipped.length} skipped` : ''}{result.failed.length ? ` · ${result.failed.length} failed` : ''}
      </p>
      {problems.length > 0 && (
        <ul className="mt-1 list-disc pl-5">
          {problems.slice(0, 8).map((p) => <li key={p.studentId}>{p.name}: {p.reason}</li>)}
          {problems.length > 8 && <li>…and {problems.length - 8} more</li>}
        </ul>
      )}
    </Alert>
  );
}
