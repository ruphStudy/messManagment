'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Camera, CameraOff, Keyboard, Loader2 } from 'lucide-react';
import type QrScannerType from 'qr-scanner';
import { Permission, type MealType, type ServeResult } from '@mess/shared';
import { MealPicker } from '@/components/attendance/meal-picker';
import { ServeResultBanner, type BannerState } from '@/components/attendance/serve-result-banner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/loader';
import { api, ApiError } from '@/lib/api';
import { RequireAuth } from '@/lib/auth/guards';
import { defaultMeal, useServedMeals } from '@/lib/use-served-meals';

type CameraState = 'idle' | 'starting' | 'running' | 'denied' | 'unavailable' | 'insecure';

/** How long feedback stays on screen before scanning resumes. */
const SHOW_SUCCESS_MS = 2000;
const SHOW_FAILURE_MS = 3500;
/** Ignore the same QR read again within this window (the camera sees it many times per second). */
const SAME_CODE_COOLDOWN_MS = 4000;

function Scanner({ meals }: { meals: MealType[] }) {
  const [meal, setMeal] = useState<MealType>(() => defaultMeal(meals));
  const [camera, setCamera] = useState<CameraState>('idle');
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [verifying, setVerifying] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScannerType | null>(null);
  const busyRef = useRef(false);
  const lastCodeRef = useRef<{ code: string; at: number } | null>(null);
  const mealRef = useRef(meal);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  mealRef.current = meal;

  const show = (state: BannerState, ms: number) => {
    setBanner(state);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setBanner(null), ms);
  };

  const submit = useCallback(async (code: string) => {
    const now = Date.now();
    const last = lastCodeRef.current;
    if (busyRef.current || (last && last.code === code && now - last.at < SAME_CODE_COOLDOWN_MS)) return;
    busyRef.current = true;
    lastCodeRef.current = { code, at: now };
    setVerifying(true);
    try {
      const result = await api<ServeResult>('/attendance/scan', { method: 'POST', body: { qrToken: code, mealType: mealRef.current } });
      const ok = result.outcome === 'SERVED';
      navigator.vibrate?.(ok ? 80 : [60, 60, 60]);
      show({ kind: 'result', result }, ok ? SHOW_SUCCESS_MS : SHOW_FAILURE_MS);
    } catch (error) {
      // Never assume success offline: staff must not serve without a verified result.
      show(error instanceof ApiError && !error.isNetwork ? { kind: 'result', result: rejectionFromError(error, mealRef.current) } : { kind: 'network' }, SHOW_FAILURE_MS);
      lastCodeRef.current = null;
    } finally {
      busyRef.current = false;
      setVerifying(false);
    }
  }, []);

  const start = async () => {
    if (!window.isSecureContext) return setCamera('insecure');
    setCamera('starting');
    try {
      const QrScanner = (await import('qr-scanner')).default;
      if (!(await QrScanner.hasCamera())) return setCamera('unavailable');
      scannerRef.current?.destroy();
      const scanner = new QrScanner(videoRef.current!, (r) => void submit(r.data), {
        returnDetailedScanResult: true,
        preferredCamera: 'environment',
        highlightScanRegion: true,
        maxScansPerSecond: 8,
      });
      scannerRef.current = scanner;
      await scanner.start();
      setCamera('running');
    } catch (error) {
      const denied = String(error).toLowerCase().includes('denied') || (error as DOMException)?.name === 'NotAllowedError';
      setCamera(denied ? 'denied' : 'unavailable');
    }
  };

  useEffect(
    () => () => {
      scannerRef.current?.destroy();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  const stop = () => {
    scannerRef.current?.stop();
    setCamera('idle');
  };

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <MealPicker meals={meals} value={meal} onChange={setMeal} />

      <div className="relative overflow-hidden rounded-card border border-border bg-ink">
        <video ref={videoRef} muted playsInline className={camera === 'running' ? 'aspect-square w-full object-cover sm:aspect-video' : 'hidden'} />
        {camera !== 'running' && (
          <div className="flex aspect-square flex-col items-center justify-center gap-3 p-6 text-center text-white sm:aspect-video">
            {camera === 'starting' ? (
              <><Loader2 className="size-8 animate-spin" aria-hidden /><p>Starting camera…</p></>
            ) : camera === 'denied' ? (
              <>
                <CameraOff className="size-10" aria-hidden />
                <p className="font-semibold">Camera permission was blocked</p>
                <p className="text-sm opacity-80">Allow camera access in your browser&apos;s site settings (lock icon in the address bar), then try again.</p>
                <Button onClick={start}>Try again</Button>
              </>
            ) : camera === 'unavailable' ? (
              <>
                <CameraOff className="size-10" aria-hidden />
                <p className="font-semibold">No camera available</p>
                <p className="text-sm opacity-80">Use manual entry instead.</p>
              </>
            ) : camera === 'insecure' ? (
              <>
                <CameraOff className="size-10" aria-hidden />
                <p className="font-semibold">Camera needs a secure (https) connection</p>
              </>
            ) : (
              <>
                <Camera className="size-10" aria-hidden />
                <Button size="lg" onClick={start}>Start scanning</Button>
              </>
            )}
          </div>
        )}
        {verifying && (
          <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-2 bg-ink/80 py-2 text-sm text-white">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Verifying…
          </div>
        )}
      </div>

      <div aria-live="assertive" className="min-h-24">
        {banner ? <ServeResultBanner state={banner} /> : camera === 'running' && <p className="text-center text-ink-muted">Point the camera at the student&apos;s QR code</p>}
      </div>

      <div className="flex flex-wrap justify-between gap-2">
        <Link href="/attendance/manual" className="inline-flex min-h-11 items-center gap-2 rounded-control px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50">
          <Keyboard className="size-4" aria-hidden /> Manual entry
        </Link>
        {camera === 'running' && <Button variant="secondary" onClick={stop}>Stop camera</Button>}
      </div>
    </div>
  );
}

/** HTTP errors (e.g. session/permission) shown in the same banner style. */
function rejectionFromError(error: ApiError, mealType: MealType): ServeResult {
  return { outcome: 'REJECTED', reason: error.code as never, message: error.message, mealType, student: null, planName: null };
}

export default function ScanPage() {
  const meals = useServedMeals();
  return (
    <RequireAuth permission={Permission.ATTENDANCE_MARK}>
      <Link href="/attendance" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Attendance
      </Link>
      <h1 className="mb-4 text-display font-bold tracking-tight">Scan meal QR</h1>
      {!meals ? <PageLoader /> : <Scanner meals={meals} />}
      <Alert tone="info" className="mx-auto mt-6 max-w-xl">Tip: keep this page open while serving — it scans the next student automatically.</Alert>
    </RequireAuth>
  );
}
