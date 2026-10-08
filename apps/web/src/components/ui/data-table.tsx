'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface DataColumn<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

interface Props<T> {
  rows: T[];
  columns: DataColumn<T>[];
  rowKey: (row: T) => string;
  /** Makes each row/card a link (e.g. to a detail page). */
  rowHref?: (row: T) => string;
}

/**
 * Generic list: table on large screens, cards on small ones (first column is the card title).
 */
export function DataTable<T>({ rows, columns, rowKey, rowHref }: Props<T>) {
  const [first, ...rest] = columns;
  return (
    <>
      <div className="hidden overflow-x-auto rounded-card border border-border bg-surface lg:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-canvas text-ink-muted">
            <tr>
              {columns.map((c) => (
                <th key={c.header} scope="col" className={cn('whitespace-nowrap px-3 py-3 font-medium', c.className)}>{c.header}</th>
              ))}
              {rowHref && <th scope="col" className="w-8"><span className="sr-only">Open</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={rowKey(row)} className={cn(rowHref && 'relative hover:bg-canvas')}>
                {columns.map((c, i) => (
                  <td key={c.header} className={cn('px-3 py-2.5', c.className)}>
                    {i === 0 && rowHref ? (
                      // Stretched link: the whole row is clickable, text stays selectable elsewhere.
                      <Link href={rowHref(row)} className="font-medium text-brand-700 after:absolute after:inset-0 hover:underline">{c.cell(row)}</Link>
                    ) : (
                      c.cell(row)
                    )}
                  </td>
                ))}
                {rowHref && <td className="px-2"><ChevronRight className="size-4 text-ink-muted" aria-hidden /></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 lg:hidden">
        {rows.map((row) => {
          const body = (
            <>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{first.cell(row)}</div>
                <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                  {rest.map((c) => (
                    <div key={c.header} className="contents">
                      <dt className="text-ink-muted">{c.header}</dt>
                      <dd className="min-w-0 break-words">{c.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              {rowHref && <ChevronRight className="size-5 shrink-0 self-center text-ink-muted" aria-hidden />}
            </>
          );
          return (
            <li key={rowKey(row)}>
              {rowHref ? (
                <Link href={rowHref(row)} className="flex gap-3 rounded-card border border-border bg-surface p-4 hover:border-brand-300">{body}</Link>
              ) : (
                <div className="flex gap-3 rounded-card border border-border bg-surface p-4">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
