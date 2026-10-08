'use client';

import { REPORT_COLUMNS, reportDisplayValue, type ReportColumn, type ReportType } from '@mess/shared';
import { cn } from '@/lib/cn';

/** Same columns as the CSV export. Table on large screens, cards on small ones. Reversed/cancelled rows are dimmed. */
export function ReportTable({ type, rows }: { type: ReportType; rows: unknown[] }) {
  const columns = REPORT_COLUMNS[type] as ReportColumn<unknown>[];
  const statusColumn = columns.find((c) => c.header === 'Status');
  const dimmed = (row: unknown) => ['Reversed', 'Cancelled'].includes(String(statusColumn?.value(row) ?? ''));
  const [first, ...rest] = columns;

  return (
    <>
      <div className="hidden overflow-x-auto rounded-card border border-border bg-surface lg:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-canvas text-ink-muted">
            <tr>
              {columns.map((c) => (
                <th key={c.header} scope="col" className={cn('whitespace-nowrap px-3 py-3 font-medium', c.kind === 'money' && 'text-right')}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, i) => (
              <tr key={i} className={cn(dimmed(row) && 'bg-canvas text-ink-muted')}>
                {columns.map((c) => (
                  <td key={c.header} className={cn('max-w-64 px-3 py-2.5', c.kind === 'money' ? 'whitespace-nowrap text-right font-semibold' : c.kind ? 'whitespace-nowrap' : 'break-words')}>
                    {reportDisplayValue(c, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 lg:hidden">
        {rows.map((row, i) => (
          <li key={i} className={cn('rounded-card border border-border p-4', dimmed(row) ? 'bg-canvas text-ink-muted' : 'bg-surface')}>
            <p className="font-semibold">{reportDisplayValue(first, row)}</p>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
              {rest.map((c) => (
                <div key={c.header} className="contents">
                  <dt className="text-ink-muted">{c.header}</dt>
                  <dd className="min-w-0 break-words">{reportDisplayValue(c, row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
