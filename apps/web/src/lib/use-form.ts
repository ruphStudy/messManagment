'use client';

import { useCallback, useState, type FormEvent } from 'react';
import { ApiError, errorMessage } from '@/lib/api';

export type FieldErrors<T> = Partial<Record<keyof T | string, string>>;

interface Options<T> {
  initial: T;
  validate: (values: T) => FieldErrors<T>;
}

/** Minimal form state: client validation, submit state and mapping of API field errors. */
export function useForm<T extends Record<string, unknown>>({ initial, validate }: Options<T>) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<FieldErrors<T>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }, []);

  const validateFields = useCallback(
    (keys?: (keyof T | string)[]) => {
      const all = validate(values);
      const next = keys ? Object.fromEntries(keys.map((k) => [k, all[k]])) : all;
      setErrors((e) => ({ ...e, ...next }));
      return !Object.values(next).some(Boolean);
    },
    [validate, values],
  );

  const handleSubmit = (onValid: (values: T) => Promise<void>) => async (event?: FormEvent) => {
    event?.preventDefault();
    setFormError(null);
    if (!validateFields()) return;
    setSubmitting(true);
    try {
      await onValid(values);
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        setErrors(Object.fromEntries(Object.entries(error.fields).map(([k, v]) => [k, v[0]])) as FieldErrors<T>);
      }
      setFormError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return { values, setValues, errors, setField, formError, submitting, handleSubmit, validateFields };
}
