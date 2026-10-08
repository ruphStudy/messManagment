'use client';

import { can, MESS_SETTINGS_FIELDS, Permission, type MessProfile } from '@mess/shared';
import { FoodTypeField, MealTimingFields, MessBasicFields, MessLocationFields, MessMealFields } from '@/components/mess/mess-fields';
import { Alert } from '@/components/ui/alert';
import { Card, CardHeader } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { messToForm, toMessInput, validateMess, type MessFormValues } from '@/lib/mess-form';
import { useForm } from '@/lib/use-form';
import { SaveBar } from './save-bar';

const PROFILE_FIELDS = ['name', 'mobile', 'email', 'messType', 'address', 'city', 'state', 'pincode', 'foodType'] as const;

const pick = <T extends object>(obj: T, keys: readonly string[]) => Object.fromEntries(Object.entries(obj).filter(([k]) => keys.includes(k)));

interface Props {
  mess: MessProfile;
  onSaved: (mess: MessProfile) => void;
}

function useMessForm(mess: MessProfile) {
  const initial = messToForm(mess);
  const form = useForm<MessFormValues>({ initial, validate: validateMess });
  const dirty = JSON.stringify(form.values) !== JSON.stringify(initial);
  return { form, initial, dirty };
}

/** Name, contact, address, food type — owner only (PATCH /mess). */
export function MessProfileForm({ mess, onSaved }: Props) {
  const { session, reload } = useAuth();
  const toast = useToast();
  const canEdit = can(session?.role, Permission.MESS_UPDATE);
  const { form, initial, dirty } = useMessForm(mess);
  const onSubmit = form.handleSubmit(async (values) => {
    const updated = await api<MessProfile>('/mess', { method: 'PATCH', body: pick(toMessInput(values), PROFILE_FIELDS) });
    onSaved(updated);
    if (updated.name !== mess.name) await reload();
    toast.success('Mess profile saved');
  });
  const fieldProps = { ...form, disabled: !canEdit || form.submitting };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 pb-24">
      {!canEdit && <Alert tone="info">Only the owner can change the mess name, contact and address.</Alert>}
      <Card>
        <CardHeader title="Basic details" description="Name and contact shown to students" />
        <MessBasicFields {...fieldProps} />
      </Card>
      <Card>
        <CardHeader title="Address" />
        <MessLocationFields {...fieldProps} />
      </Card>
      <Card>
        <CardHeader title="Food" />
        <FoodTypeField {...fieldProps} />
      </Card>
      {canEdit && <SaveBar dirty={dirty} submitting={form.submitting} error={form.formError} onDiscard={() => form.setValues(initial)} />}
    </form>
  );
}

/** Meals served, opening hours, serving windows and pause cut-offs — owner or manager (PATCH /mess/settings). */
export function MealSettingsForm({ mess, onSaved }: Props) {
  const { session } = useAuth();
  const toast = useToast();
  const canEdit = can(session?.role, Permission.MESS_SETTINGS_UPDATE);
  const { form, initial, dirty } = useMessForm(mess);
  const onSubmit = form.handleSubmit(async (values) => {
    onSaved(await api<MessProfile>('/mess/settings', { method: 'PATCH', body: pick(toMessInput(values), MESS_SETTINGS_FIELDS) }));
    toast.success('Meal settings saved');
  });
  const fieldProps = { ...form, disabled: !canEdit || form.submitting };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 pb-24">
      {!canEdit && <Alert tone="info">You can view these settings. The owner or a manager can change them.</Alert>}
      <Card>
        <CardHeader title="Meals & opening hours" />
        <MessMealFields {...fieldProps} hideFoodType />
      </Card>
      <Card>
        <CardHeader
          title="Serving times & pause cut-offs"
          description="Serving times pick the default meal when scanning and show students their current/next meal. Students can pause today's meal only before the cut-off; future days can always be paused. Indian time."
        />
        <MealTimingFields {...fieldProps} />
      </Card>
      {canEdit && <SaveBar dirty={dirty} submitting={form.submitting} error={form.formError} onDiscard={() => form.setValues(initial)} />}
    </form>
  );
}
