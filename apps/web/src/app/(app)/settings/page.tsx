'use client';

import { useCallback, useEffect, useState } from 'react';
import { can, MessStatus, Permission, type MessProfile } from '@mess/shared';
import { MessBasicFields, MessLocationFields, MessMealFields } from '@/components/mess/mess-fields';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { messToForm, toMessInput, validateMess, type MessFormValues } from '@/lib/mess-form';
import { useForm } from '@/lib/use-form';

function SettingsSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <Skeleton className="mb-5 h-5 w-40" />
          <Skeleton className="mb-3 h-11 w-full" />
          <Skeleton className="h-11 w-2/3" />
        </Card>
      ))}
    </div>
  );
}

function MessSettingsForm({ mess, onSaved }: { mess: MessProfile; onSaved: (mess: MessProfile) => void }) {
  const { session, reload } = useAuth();
  const toast = useToast();
  const canEdit = can(session?.role, Permission.MESS_UPDATE);
  const initial = messToForm(mess);

  const form = useForm<MessFormValues>({ initial, validate: validateMess });
  const dirty = JSON.stringify(form.values) !== JSON.stringify(initial);

  const onSubmit = form.handleSubmit(async (values) => {
    const updated = await api<MessProfile>('/mess', { method: 'PATCH', body: toMessInput(values) });
    onSaved(updated);
    if (updated.name !== mess.name) await reload();
    toast.success('Changes saved');
  });

  const fieldProps = { ...form, disabled: !canEdit || form.submitting };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 pb-24">
      {!canEdit && <Alert tone="info">You can view these details. Only the owner or manager can change them.</Alert>}

      <Card>
        <CardHeader title="Basic details" description="Name and contact shown to students" />
        <MessBasicFields {...fieldProps} />
      </Card>
      <Card>
        <CardHeader title="Address" />
        <MessLocationFields {...fieldProps} />
      </Card>
      <Card>
        <CardHeader title="Meals & timings" />
        <MessMealFields {...fieldProps} />
      </Card>
      <Card>
        <CardHeader title="Logo" description="Logo upload will be available in a later update." />
      </Card>

      {canEdit && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-5xl items-center justify-end gap-2 sm:px-2">
            {form.formError && <p className="mr-auto text-sm text-danger">{form.formError}</p>}
            <Button variant="secondary" disabled={!dirty || form.submitting} onClick={() => form.setValues(initial)}>
              Discard
            </Button>
            <Button type="submit" disabled={!dirty} loading={form.submitting}>
              Save changes
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}

export default function SettingsPage() {
  const [mess, setMess] = useState<MessProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api<MessProfile>('/mess')
      .then(setMess)
      .catch((e: unknown) => setError(errorMessage(e)));
  }, []);

  useEffect(load, [load]);

  return (
    <>
      <PageHeader
        title="Mess settings"
        description="Your mess profile, address and timings"
        actions={mess && <Badge tone={mess.status === MessStatus.ACTIVE ? 'success' : 'danger'}>{mess.status === MessStatus.ACTIVE ? 'Active' : 'Suspended'}</Badge>}
      />
      {error ? (
        <ErrorState title="Couldn't load your mess" description={error} onRetry={load} />
      ) : mess ? (
        <MessSettingsForm key={mess.updatedAt} mess={mess} onSaved={setMess} />
      ) : (
        <SettingsSkeleton />
      )}
    </>
  );
}
