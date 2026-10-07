import { FOOD_TYPE_LABELS, MESS_TYPE_LABELS } from '@mess/shared';
import type { MessFormValues } from '@/lib/mess-form';

function formatTime(time: string) {
  if (!time) return 'Not set';
  const [h, m] = time.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export function mealsLabel(v: Pick<MessFormValues, 'breakfastAvailable' | 'lunchAvailable' | 'dinnerAvailable'>) {
  return (
    [v.breakfastAvailable && 'Breakfast', v.lunchAvailable && 'Lunch', v.dinnerAvailable && 'Dinner'].filter(Boolean).join(', ') ||
    'None'
  );
}

export function MessSummary({ values }: { values: MessFormValues }) {
  const rows: [string, string][] = [
    ['Mess name', values.name],
    ['Type', MESS_TYPE_LABELS[values.messType]],
    ['Contact', `+91 ${values.mobile}${values.email ? ` · ${values.email}` : ''}`],
    ['Address', `${values.address}, ${values.city}, ${values.state} ${values.pincode}`],
    ['Meals', mealsLabel(values)],
    ['Food', FOOD_TYPE_LABELS[values.foodType]],
    ['Timings', values.openingTime || values.closingTime ? `${formatTime(values.openingTime)} – ${formatTime(values.closingTime)}` : 'Not set'],
  ];
  return (
    <dl className="divide-y divide-border rounded-control border border-border">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-3">
          <dt className="text-sm text-ink-muted">{label}</dt>
          <dd className="text-sm font-medium sm:col-span-2">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
