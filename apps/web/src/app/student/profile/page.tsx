'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DEFAULT_COUNTRY_CODE,
  firstError,
  LIMITS,
  STUDENT_STATUS_LABELS,
  validators,
  type NotificationPreferences,
  type StudentMeResponse,
  type StudentSelfProfile,
  type StudentSelfUpdate,
} from '@mess/shared';
import { NotLinkedCard } from '@/components/student/student-ui';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/loader';
import { ConfirmDialog } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate } from '@/lib/format';
import { useApi } from '@/lib/student/use-api';
import { ThemeSelector } from '@/components/ui/theme-selector';
import { useStudentMess } from '@/lib/student/mess-context';

const phone = (m: string) => `${DEFAULT_COUNTRY_CODE} ${m}`;

/** Only the low-risk fields the API allows students to change (STUDENT_SELF_EDITABLE). */
const FIELDS: { key: keyof StudentSelfUpdate; label: string; max: number }[] = [
  { key: 'email', label: 'Email', max: LIMITS.emailMax },
  { key: 'collegeName', label: 'College', max: LIMITS.textMax },
  { key: 'courseName', label: 'Course', max: LIMITS.textMax },
  { key: 'hostelOrPg', label: 'Hostel / PG', max: LIMITS.textMax },
  { key: 'localAddress', label: 'Local address', max: LIMITS.addressMax },
];

function Rows({ rows }: { rows: [string, string | null | undefined][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
      {rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-ink-muted">{k}</dt><dd className={v ? 'font-medium' : 'text-ink-muted'}>{v || 'Not added'}</dd></div>)}
    </dl>
  );
}

function EditForm({ profile, onSaved, onCancel }: { profile: StudentSelfProfile; onSaved: (p: StudentSelfProfile) => void; onCancel: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(FIELDS.map(({ key }) => [key, profile[key] ?? ''])));
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = Object.fromEntries(FIELDS.map(({ key, max }) => [key, key === 'email' ? validators.optionalEmail(values.email) : firstError(values[key].trim(), validators.maxLength(max))]));
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setSaving(true);
    setFormError(null);
    try {
      onSaved(await api<StudentSelfProfile>('/students/me', { method: 'PATCH', body: Object.fromEntries(FIELDS.map(({ key }) => [key, values[key].trim() || null])) }));
    } catch (err) {
      setFormError(errorMessage(err));
      setSaving(false);
    }
  };
  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-3">
      {FIELDS.map(({ key, label }) => (
        <Input key={key} id={key} label={label} type={key === 'email' ? 'email' : 'text'} value={values[key]} error={errors[key]} onChange={(e) => { setValues((v) => ({ ...v, [key]: e.target.value })); setErrors((x) => ({ ...x, [key]: undefined })); }} />
      ))}
      <p className="text-xs text-ink-muted">To change your name, mobile number or joining date, please contact your mess.</p>
      {formError && <Alert tone="danger">{formError}</Alert>}
      <div className="flex gap-2"><Button type="submit" loading={saving}>Save</Button><Button variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button></div>
    </form>
  );
}

const TOGGLES: { key: keyof NotificationPreferences; label: string; hint: string }[] = [
  { key: 'paymentDueEnabled', label: 'Payment reminders', hint: 'When your mess reminds you about fees' },
  { key: 'subscriptionExpiryEnabled', label: 'Plan expiry', hint: 'A few days before your plan ends' },
  { key: 'menuUpdatesEnabled', label: 'Menu changes', hint: "When today's or tomorrow's menu changes" },
  { key: 'pauseUpdatesEnabled', label: 'Pause updates', hint: 'When meals are paused or resumed' },
  { key: 'pushEnabled', label: 'Phone alerts (push)', hint: 'Alerts on phones where you use the MessMate app' },
];

function Preferences() {
  const toast = useToast();
  const { data, error, reload, setData } = useApi<NotificationPreferences>('/notification-preferences');
  const toggle = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!data) return;
    const previous = data;
    setData({ ...data, [key]: value });
    try {
      setData(await api<NotificationPreferences>('/notification-preferences', { method: 'PATCH', body: { [key]: value } }));
    } catch (e) {
      setData(previous);
      toast.error(errorMessage(e));
    }
  };
  return (
    <Card>
      <CardHeader title="Notification settings" description="Reminders sent personally by your mess always appear in Notifications." />
      {error ? (
        <ErrorState title="Couldn't load settings" description={error} onRetry={reload} />
      ) : !data ? (
        <Skeleton className="h-32" />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {TOGGLES.map((t) => (
            <li key={t.key} className="flex min-h-14 items-center gap-3">
              <label htmlFor={`pref-${t.key}`} className="flex-1"><span className="block font-medium">{t.label}</span><span className="block text-xs text-ink-muted">{t.hint}</span></label>
              <input id={`pref-${t.key}`} type="checkbox" role="switch" checked={data[t.key]} onChange={(e) => void toggle(t.key, e.target.checked)} className="size-5 accent-brand-600" />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function StudentProfilePage() {
  const { session, logout } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { data, error, reload, setData } = useApi<StudentMeResponse>('/students/me');
  const messCtx = useStudentMess();
  const [editing, setEditing] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [leaving, setLeaving] = useState(false);
  if (!session) return null;
  const profile = data?.linked ? data.profile : null;
  const hasFamily = profile && (profile.parentName || profile.parentMobile || profile.emergencyContactName || profile.emergencyContactMobile);

  return (
    <>
      <PageHeader title="Profile" description={profile ? [profile.firstName, profile.lastName].filter(Boolean).join(' ') : phone(session.user.mobile)} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          {error ? (
            <ErrorState title="Couldn't load your profile" description={error} onRetry={reload} />
          ) : !data ? (
            <Skeleton className="h-48" />
          ) : !profile ? (
            <NotLinkedCard mobile={session.user.mobile} />
          ) : (
            <>
              <Card>
                <CardHeader title={messCtx && messCtx.memberships.length > 1 ? `Mess (${messCtx.memberships.length} linked)` : 'Mess'} action={<Badge tone={profile.mess.status === 'SUSPENDED' ? 'danger' : 'success'}>{profile.mess.status === 'SUSPENDED' ? 'Temporarily unavailable' : 'Active'}</Badge>} />
                <Rows rows={[['Mess', profile.mess.name], ['Joined', formatDate(profile.joiningDate)], ['Membership', STUDENT_STATUS_LABELS[profile.status]], ['Mess contact', phone(profile.mess.mobile)]]} />
                {messCtx && messCtx.memberships.length > 1 && (
                  <div className="mt-3"><Button size="sm" variant="secondary" onClick={messCtx.openChooser}>Switch mess</Button></div>
                )}
              </Card>
              <Card>
                <CardHeader title="Your details" action={!editing && <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit details</Button>} />
                {editing ? (
                  <EditForm profile={profile} onCancel={() => setEditing(false)} onSaved={(p) => { setData({ linked: true, profile: p }); setEditing(false); toast.success('Profile updated'); }} />
                ) : (
                  <Rows rows={[['Mobile', phone(profile.mobile)], ['Email', profile.email], ['College', profile.collegeName], ['Course', profile.courseName], ['Hostel / PG', profile.hostelOrPg], ['Address', profile.localAddress]]} />
                )}
              </Card>
              {hasFamily && (
                <Card>
                  <CardHeader title="Family & emergency" />
                  <Rows rows={[['Parent', profile.parentName], ['Parent mobile', profile.parentMobile && phone(profile.parentMobile)], ['Emergency contact', profile.emergencyContactName], ['Emergency mobile', profile.emergencyContactMobile && phone(profile.emergencyContactMobile)]]} />
                </Card>
              )}
              <div className="flex flex-wrap gap-3 text-sm font-medium text-brand-700">
                <Link href="/student/plans" className="hover:underline">Plan history</Link>
                <Link href="/student/meals" className="hover:underline">Meal history</Link>
                <Link href="/student/complaints" className="hover:underline">My complaints</Link>
              </div>
            </>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Account" />
            <Rows rows={[['Sign-in mobile', phone(session.user.mobile)], ['Account', session.user.status === 'ACTIVE' ? 'Active' : 'Disabled'], ['Sign-in method', 'One-time code (OTP)']]} />
          </Card>
          <Preferences />
          <Card>
            <CardHeader title="Appearance" description="Saved on this browser. System follows your device setting." />
            <ThemeSelector />
          </Card>
          <div><Button variant="secondary" onClick={() => setConfirmOut(true)}>Sign out</Button></div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmOut}
        title="Sign out?"
        description="You will need your mobile number and a code to sign in again."
        confirmLabel="Sign out"
        tone="danger"
        loading={leaving}
        onConfirm={async () => { setLeaving(true); await logout().catch(() => undefined); router.replace('/login/otp'); }}
        onCancel={() => setConfirmOut(false)}
      />
    </>
  );
}
