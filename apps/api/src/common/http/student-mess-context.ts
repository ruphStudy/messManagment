import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';
import { STUDENT_MESS_HEADER } from '@mess/shared';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const store = new AsyncLocalStorage<{ messId: string | null }>();

/**
 * Carries the student's selected mess (`x-mess-id`) through the request without threading it through every
 * service. It is only a *selection*: StudentsService verifies the user really has a record in that mess.
 */
export function studentMessContextMiddleware(req: Request, _res: Response, next: NextFunction) {
  const raw = req.header(STUDENT_MESS_HEADER);
  store.run({ messId: raw && UUID.test(raw) ? raw.toLowerCase() : null }, next);
}

/** The mess the client selected for this request, or null. */
export function selectedStudentMessId(): string | null {
  return store.getStore()?.messId ?? null;
}
