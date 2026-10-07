'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { DEFAULT_COUNTRY_CODE, normalizeMobile } from '@mess/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Input, type InputProps } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { validateStudent, type StudentFormValues } from '@/lib/student-form';
import { useForm } from '@/lib/use-form';

interface StudentFormProps {
  initial: StudentFormValues;
  submitLabel: string;
  cancelHref: string;
  onSubmit: (values: StudentFormValues) => Promise<void>;
  /** When editing a student who uses the app, warn before their login number changes. */
  appLinked?: boolean;
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

/** Single form used by both Add and Edit student. */
export function StudentForm({ initial, submitLabel, cancelHref, onSubmit, appLinked }: StudentFormProps) {
  const form = useForm<StudentFormValues>({ initial, validate: validateStudent });
  const { values, errors, setField } = form;

  const field = (key: keyof StudentFormValues, label: string, extra: Partial<InputProps> = {}) => (
    <Input
      id={key}
      label={label}
      value={values[key]}
      error={errors[key]}
      onChange={(e) => setField(key, e.target.value)}
      onBlur={() => values[key] && form.validateFields([key])}
      disabled={form.submitting}
      {...extra}
    />
  );
  const mobileField = (key: 'mobile' | 'parentMobile' | 'emergencyContactMobile', label: string, required = false) =>
    field(key, label, {
      prefix: DEFAULT_COUNTRY_CODE,
      inputMode: 'tel',
      autoComplete: 'off',
      maxLength: 16,
      required,
      onBlur: () => {
        const normalized = normalizeMobile(values[key]);
        if (normalized && normalized !== values[key]) setField(key, normalized);
        if (values[key]) form.validateFields([key]);
      },
    });

  const mobileChanged = appLinked && normalizeMobile(values.mobile) !== initial.mobile;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <Section title="Basic information">
        {field('firstName', 'First name', { required: true, autoComplete: 'off' })}
        {field('lastName', 'Last name', { autoComplete: 'off' })}
        {mobileField('mobile', 'Mobile number', true)}
        {field('email', 'Email', { type: 'email', autoComplete: 'off' })}
        {mobileChanged && (
          <Alert tone="info" className="sm:col-span-2">
            This student uses the mobile app. After changing the number they must sign in with the new number.
          </Alert>
        )}
      </Section>

      <Section title="Study / residence">
        {field('collegeName', 'College name')}
        {field('courseName', 'Course')}
        {field('hostelOrPg', 'Hostel / PG')}
        {field('joiningDate', 'Joining date', { type: 'date', required: true })}
      </Section>

      <Section title="Family & emergency" description="Who to call if something happens">
        {field('parentName', 'Parent name')}
        {mobileField('parentMobile', 'Parent mobile')}
        {field('emergencyContactName', 'Emergency contact name')}
        {mobileField('emergencyContactMobile', 'Emergency contact mobile')}
      </Section>

      <Card>
        <CardHeader title="Other" />
        <div className="flex flex-col gap-4">
          <Textarea
            id="localAddress"
            label="Local address"
            rows={2}
            value={values.localAddress}
            error={errors.localAddress}
            disabled={form.submitting}
            onChange={(e) => setField('localAddress', e.target.value)}
          />
          <Textarea
            id="notes"
            label="Notes"
            hint="Only your mess team can see notes"
            rows={3}
            value={values.notes}
            error={errors.notes}
            disabled={form.submitting}
            onChange={(e) => setField('notes', e.target.value)}
          />
        </div>
      </Card>

      {form.formError && <Alert tone="danger">{form.formError}</Alert>}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link
          href={cancelHref}
          className="inline-flex h-11 items-center justify-center rounded-control border border-border bg-surface px-4 text-sm font-semibold hover:bg-canvas"
        >
          Cancel
        </Link>
        <Button type="submit" size="lg" loading={form.submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
