'use client';

import { Button } from '@/components/ui/button';

/** Sticky Discard / Save bar for long settings forms. */
export function SaveBar({ dirty, submitting, error, onDiscard }: { dirty: boolean; submitting: boolean; error: string | null; onDiscard: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:left-64">
      <div className="mx-auto flex max-w-5xl items-center justify-end gap-2 sm:px-2">
        {error && <p className="mr-auto text-sm text-danger">{error}</p>}
        <Button variant="secondary" disabled={!dirty || submitting} onClick={onDiscard}>Discard</Button>
        <Button type="submit" disabled={!dirty} loading={submitting}>Save changes</Button>
      </div>
    </div>
  );
}
