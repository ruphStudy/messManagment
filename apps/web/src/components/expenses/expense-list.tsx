'use client';

import { Pencil, Undo2 } from 'lucide-react';
import { ExpenseStatus, formatPaise, PAYMENT_METHOD_LABELS, type Expense } from '@mess/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';

interface Props {
  expenses: Expense[];
  onEdit?: (e: Expense) => void;
  onReverse?: (e: Expense) => void;
}

/** Table on large screens, cards on small ones. Reversed rows stay visible, struck through. */
export function ExpenseList({ expenses, onEdit, onReverse }: Props) {
  const actions = (e: Expense) =>
    e.status === ExpenseStatus.RECORDED && (onEdit || onReverse) ? (
      <div className="flex gap-1">
        {onEdit && <Button size="sm" variant="ghost" onClick={() => onEdit(e)} aria-label={`Edit ${e.title}`}><Pencil className="size-4" /></Button>}
        {onReverse && <Button size="sm" variant="ghost" className="text-danger" onClick={() => onReverse(e)} aria-label={`Reverse ${e.title}`}><Undo2 className="size-4" /></Button>}
      </div>
    ) : null;

  return (
    <>
      <div className="hidden overflow-hidden rounded-card border border-border bg-surface lg:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-canvas text-ink-muted">
            <tr>
              {['Date', 'Category', 'What for', 'Paid to', 'Amount', 'Paid by', 'Recorded by', ''].map((h) => (
                <th key={h} scope="col" className={cn('px-3 py-3 font-medium', h === 'Amount' && 'text-right')}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {expenses.map((e) => {
              const reversed = e.status === ExpenseStatus.REVERSED;
              return (
                <tr key={e.id} className={cn(reversed && 'bg-canvas text-ink-muted')}>
                  <td className="whitespace-nowrap px-3 py-2.5">{formatDate(e.expenseDate)}</td>
                  <td className="px-3 py-2.5">{e.category.name}</td>
                  <td className="max-w-56 px-3 py-2.5">
                    <span className={cn('block truncate font-medium', reversed && 'line-through')}>{e.title}</span>
                    {reversed && <Badge tone="danger">Reversed</Badge>}
                  </td>
                  <td className="max-w-40 truncate px-3 py-2.5">{e.vendorName ?? '—'}</td>
                  <td className={cn('whitespace-nowrap px-3 py-2.5 text-right font-semibold', reversed && 'line-through')}>{formatPaise(e.amountPaise)}</td>
                  <td className="px-3 py-2.5">{e.paymentMethod ? PAYMENT_METHOD_LABELS[e.paymentMethod] : '—'}</td>
                  <td className="px-3 py-2.5">{e.recordedBy ?? '—'}</td>
                  <td className="px-3 py-1">{actions(e)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 lg:hidden">
        {expenses.map((e) => {
          const reversed = e.status === ExpenseStatus.REVERSED;
          return (
            <li key={e.id} className={cn('flex items-start gap-3 rounded-card border border-border p-4', reversed ? 'bg-canvas' : 'bg-surface')}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('text-lg font-bold', reversed && 'line-through')}>{formatPaise(e.amountPaise)}</span>
                  <Badge>{e.category.name}</Badge>
                  {reversed && <Badge tone="danger">Reversed</Badge>}
                </div>
                <p className="truncate font-medium">{e.title}</p>
                <p className="text-sm text-ink-muted">
                  {formatDate(e.expenseDate)}{e.vendorName && ` · ${e.vendorName}`}{e.paymentMethod && ` · ${PAYMENT_METHOD_LABELS[e.paymentMethod]}`}
                </p>
                {reversed && e.reversalReason && <p className="text-sm text-danger">{e.reversalReason}</p>}
              </div>
              {actions(e)}
            </li>
          );
        })}
      </ul>
    </>
  );
}
