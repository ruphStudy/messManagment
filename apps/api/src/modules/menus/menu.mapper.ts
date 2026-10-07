import type { DailyMenu as MenuRow, Prisma } from '@prisma/client';
import type { DailyMenu, DailyMenuInput, PublishedMenu } from '@mess/shared';
import { toDateString } from '../../common/http/dates';

export function toMenuInput(row: MenuRow): DailyMenuInput {
  return {
    breakfast: { available: row.breakfastAvailable, items: row.breakfastItems, note: row.breakfastNote },
    lunch: { available: row.lunchAvailable, items: row.lunchItems, note: row.lunchNote },
    dinner: { available: row.dinnerAvailable, items: row.dinnerItems, note: row.dinnerNote },
    generalNote: row.generalNote,
  };
}

export function toDailyMenu(row: MenuRow): DailyMenu {
  return {
    id: row.id,
    date: toDateString(row.menuDate),
    ...toMenuInput(row),
    isPublished: row.isPublished,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Student view: no ids or publish metadata. */
export function toPublishedMenu(row: MenuRow): PublishedMenu {
  return { ...toMenuInput(row), updatedAt: row.updatedAt.toISOString() };
}

/** Menu content columns (shared by save and copy). */
export function toContentData(menu: DailyMenuInput) {
  return {
    breakfastItems: menu.breakfast.items,
    lunchItems: menu.lunch.items,
    dinnerItems: menu.dinner.items,
    breakfastAvailable: menu.breakfast.available,
    lunchAvailable: menu.lunch.available,
    dinnerAvailable: menu.dinner.available,
    breakfastNote: menu.breakfast.note,
    lunchNote: menu.lunch.note,
    dinnerNote: menu.dinner.note,
    generalNote: menu.generalNote,
  } satisfies Prisma.DailyMenuUncheckedUpdateInput;
}
