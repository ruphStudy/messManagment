import { UtensilsCrossed } from 'lucide-react';

export const APP_NAME = 'MessMate';

export function Logo() {
  return (
    <span className="flex items-center gap-2 text-lg font-bold">
      <span className="grid size-9 place-items-center rounded-control bg-brand-600 text-white">
        <UtensilsCrossed className="size-5" aria-hidden />
      </span>
      {APP_NAME}
    </span>
  );
}
