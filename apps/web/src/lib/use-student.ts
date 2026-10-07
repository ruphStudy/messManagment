'use client';

import { useCallback, useEffect, useState } from 'react';
import type { StudentDetail } from '@mess/shared';
import { api, ApiError, errorMessage } from './api';

/** Loads one student of the current mess. `notFound` covers both missing ids and other messes' students. */
export function useStudent(id: string) {
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [error, setError] = useState<{ message: string; notFound: boolean } | null>(null);

  const load = useCallback(() => {
    setError(null);
    api<StudentDetail>(`/students/${id}`)
      .then(setStudent)
      .catch((e: unknown) => setError({ message: errorMessage(e), notFound: e instanceof ApiError && e.status === 404 }));
  }, [id]);

  useEffect(load, [load]);
  return { student, setStudent, error, reload: load };
}
