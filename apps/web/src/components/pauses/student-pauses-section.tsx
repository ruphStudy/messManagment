'use client';

import { useCallback, useEffect, useState } from 'react';
import { addDays, businessToday, can, Permission, StudentStatus, type PauseRecord, type StudentDetail } from '@mess/shared';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { ErrorState } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { fullName } from '@/lib/format';
import { CancelPauseDialog } from './cancel-pause-dialog';
import { PauseDialog } from './pause-dialog';
import { PauseRow } from './pause-row';

/** Upcoming pauses + a little history for one student. */
export function StudentPausesSection({ student }: { student: StudentDetail }) {
  const { session } = useAuth();
  const canManage = can(session?.role, Permission.PAUSE_MANAGE);
  const [upcoming, setUpcoming] = useState<PauseRecord[] | null>(null);
  const [history, setHistory] = useState<PauseRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [cancelling, setCancelling] = useState<PauseRecord | null>(null);

  const load = useCallback(() => {
    setError(null);
    const today = businessToday();
    Promise.all([
      api<PauseRecord[]>(`/pauses?studentId=${student.id}&from=${today}&status=ACTIVE&pageSize=50`),
      api<PauseRecord[]>(`/pauses?studentId=${student.id}&from=${addDays(today, -60)}&to=${today}&pageSize=100`),
    ])
      .then(([next, past]) => {
        setUpcoming(next);
        // Recent history: last 60 days up to today, newest first (cancelled ones included).
        setHistory(past.filter((p) => !next.some((n) => n.id === p.id)).reverse().slice(0, 8));
      })
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [student.id]);
  useEffect(load, [load]);

  return (
    <Card>
      <CardHeader
        title="Meal pauses"
        action={canManage && student.status === StudentStatus.ACTIVE && <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>Add pause</Button>}
      />
      {error ? (
        <ErrorState title="Couldn't load pauses" description={error} onRetry={load} />
      ) : !upcoming ? (
        <Skeleton className="h-16" />
      ) : (
        <>
          {upcoming.length === 0 ? (
            <p className="text-ink-muted">No meals paused.</p>
          ) : (
            <div className="divide-y divide-border">
              {upcoming.map((p) => <PauseRow key={p.id} pause={p} showStudent={false} onCancel={canManage ? setCancelling : undefined} />)}
            </div>
          )}
          {history.length > 0 && (
            <details className="mt-3 border-t border-border pt-3">
              <summary className="min-h-9 cursor-pointer text-sm font-medium">Recent pause history ({history.length})</summary>
              <div className="divide-y divide-border">{history.map((p) => <PauseRow key={p.id} pause={p} showStudent={false} />)}</div>
            </details>
          )}
        </>
      )}
      <PauseDialog open={adding} student={{ id: student.id, name: fullName(student) }} onClose={() => setAdding(false)} onDone={load} />
      <CancelPauseDialog pause={cancelling} onClose={() => setCancelling(null)} onDone={() => { setCancelling(null); load(); }} />
    </Card>
  );
}
