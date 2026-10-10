'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import * as QRCode from 'qrcode';
import { CheckCircle2, Circle, PauseCircle } from 'lucide-react';
import { MEAL_KEYS, MEAL_LABELS, MEAL_QR_REFRESH_BEFORE_SECONDS, type MealQrResponse } from '@mess/shared';
import { LinkedOnly } from '@/components/student/linked-only';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/api';

/** Live meal QR — same signed, short-lived token as the app (fetched only while this page is visible). */
function MealQr() {
  const [data, setData] = useState<MealQrResponse | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const expiresAt = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<MealQrResponse>('/students/me/meal-qr');
      if (res.state === 'READY') {
        // Measured from receipt so a wrong device clock can't cause refresh loops.
        expiresAt.current = Date.now() + res.expiresIn * 1000;
        setSvg(await QRCode.toString(res.token, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' }));
      } else setSvg(null);
      setData(res);
    } catch (e) {
      // Never keep showing an old code when a new one can't be issued.
      setData(null);
      setSvg(null);
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const onVisible = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  useEffect(() => {
    if (data?.state !== 'READY') return;
    const tick = () => {
      const left = Math.max(0, Math.round((expiresAt.current - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= MEAL_QR_REFRESH_BEFORE_SECONDS && !loading && document.visibilityState === 'visible') void load();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [data, loading, load]);

  if (error) return <ErrorState title="Couldn't load your meal QR" description={error} onRetry={load} />;
  if (!data) return <Skeleton className="mx-auto h-96 max-w-sm" />;
  if (data.state === 'NOT_LINKED') return <EmptyState title="Not linked to a mess yet" description="Your mess has not added your mobile number yet." />;
  if (data.state === 'MESS_UNAVAILABLE') return <EmptyState title="Mess temporarily unavailable" description={`${data.messName} is paused for now, so meal QR codes are not available. Your history is safe.`} />;
  if (data.state === 'INACTIVE') return <EmptyState title="Your membership is inactive" description={`Please contact ${data.messName} to activate it.`} />;
  if (data.state === 'NO_PLAN') return <EmptyState title="No active meal plan" description={`${data.messName} has not assigned you a meal plan for today.`} />;

  const expired = secondsLeft === 0;
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <Card className="flex flex-col items-center gap-2 text-center">
        <p className="text-lg font-semibold">{data.studentName}</p>
        <p className="text-sm text-ink-muted">{data.messName} · {data.planName}</p>
        {svg && (
          // Generated locally from the signed token (no network); safe SVG markup from the qrcode library.
          <div role="img" aria-label="Your meal QR code" className={`my-2 w-full max-w-72 rounded-card bg-white p-2 ${expired ? 'opacity-20' : ''}`} dangerouslySetInnerHTML={{ __html: svg }} />
        )}
        <p className={`text-sm font-medium ${expired ? 'text-danger' : 'text-ink-muted'}`}>{expired || loading ? 'Refreshing…' : `Refreshes in ${secondsLeft}s`}</p>
        <p className="text-xs text-ink-muted">Show this to mess staff. Turn up screen brightness if it doesn&apos;t scan.</p>
      </Card>
      <Card>
        <p className="mb-2 text-sm font-medium">Today</p>
        <ul className="flex flex-wrap gap-4">
          {MEAL_KEYS.filter((k) => data.meals[k]).map((k) => {
            const served = data.servedToday.includes(k);
            const paused = data.pausedToday.includes(k);
            return (
              <li key={k} className={`flex items-center gap-1 ${served ? 'text-success' : paused ? 'text-brand-700' : 'text-ink-muted'}`}>
                {served ? <CheckCircle2 className="size-5" aria-hidden /> : paused ? <PauseCircle className="size-5" aria-hidden /> : <Circle className="size-5" aria-hidden />}
                {MEAL_LABELS[k]} · {served ? 'Served' : paused ? 'Paused' : 'Available'}
              </li>
            );
          })}
        </ul>
      </Card>
      <Button variant="secondary" onClick={load} loading={loading}>Refresh code</Button>
      <Link href="/student/meals" className="text-center text-sm font-medium text-brand-700 hover:underline">Meal history →</Link>
    </div>
  );
}

export default function StudentQrPage() {
  return (
    <>
      <PageHeader title="Meal QR" />
      <LinkedOnly><MealQr /></LinkedOnly>
    </>
  );
}
