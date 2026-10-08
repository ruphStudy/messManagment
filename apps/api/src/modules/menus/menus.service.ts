import { HttpStatus, Injectable } from '@nestjs/common';
import type { DailyMenu as MenuRow, User } from '@prisma/client';
import {
  addDays,
  businessToday,
  daysBetween,
  ErrorCode,
  MENU_LIMITS,
  NotificationScreen,
  startOfWeek,
  StudentMenuRange,
  weekDates,
  type CopyWeekResult,
  type DailyMenu,
  type MenuDay,
  type StudentMenuResponse,
} from '@mess/shared';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AppException } from '../../common/http/app.exception';
import { fromDateString, toDateString } from '../../common/http/dates';
import { StudentsService } from '../students/students.service';
import { CopyMenuDto, CopyWeekDto, DailyMenuDto } from './dto/menu.dto';
import { toContentData, toDailyMenu, toMenuInput, toPublishedMenu } from './menu.mapper';

/** Fields reset whenever content is copied: copies always start as drafts. */
const DRAFT = { isPublished: false, publishedAt: null };

/**
 * Date-based menus, one per mess per Indian calendar date. Every query is scoped by messId
 * from the caller's membership; students only ever read published rows of their own mess.
 */
@Injectable()
export class MenusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly students: StudentsService,
    private readonly notifications: NotificationsService,
  ) {}

  async getDay(messId: string, date: string): Promise<MenuDay> {
    const row = await this.find(messId, date);
    return { date, menu: row && toDailyMenu(row) };
  }

  /** Every date in [from, to], with null for days that have no menu yet. */
  async range(messId: string, from: string, to: string): Promise<MenuDay[]> {
    this.assertRange(from, to);
    const rows = await this.prisma.dailyMenu.findMany({
      where: { messId, menuDate: { gte: fromDateString(from), lte: fromDateString(to) } },
      orderBy: { menuDate: 'asc' },
    });
    return this.fillDays(from, to, rows, toDailyMenu);
  }

  /** Creates or replaces the day's content. Publish state is kept as it was. */
  async save(messId: string, date: string, dto: DailyMenuDto): Promise<DailyMenu> {
    const content = toContentData(dto);
    const before = await this.find(messId, date);
    const row = await this.prisma.dailyMenu.upsert({
      where: { messId_menuDate: { messId, menuDate: fromDateString(date) } },
      create: { ...content, messId, menuDate: fromDateString(date) },
      update: content,
    });
    if (before?.isPublished) await this.notifyMenuChanged(messId, date, before, row);
    return toDailyMenu(row);
  }

  /**
   * Students hear about changes to an ALREADY PUBLISHED menu for today or tomorrow, and only when visible
   * content changed. First publish and draft edits stay silent. Repeated edits within 10 minutes = one notice.
   */
  private async notifyMenuChanged(messId: string, date: string, before: MenuRow, after: MenuRow) {
    const today = businessToday();
    if (date !== today && date !== addDays(today, 1)) return;
    const visible = (m: MenuRow) => JSON.stringify(toContentData(toMenuInput(m)));
    if (visible(before) === visible(after)) return;

    const when = date === today ? "Today's" : "Tomorrow's";
    const window = Math.floor(Date.now() / (10 * 60_000));
    const targets = await this.notifications.activeStudentTargets(messId, `menu-changed:${messId}:${date}:${window}`);
    await this.notifications.notifySafely(targets, {
      type: NotificationType.MENU_CHANGED,
      title: `${when} menu has changed`,
      body: `${when} menu was updated. Tap to see what's cooking.`,
      data: { screen: NotificationScreen.MENU, date },
    });
  }

  async setPublished(messId: string, date: string, published: boolean): Promise<DailyMenu> {
    const { count } = await this.prisma.dailyMenu.updateMany({
      where: { messId, menuDate: fromDateString(date) },
      data: { isPublished: published, publishedAt: published ? new Date() : null },
    });
    if (count === 0) throw AppException.notFound('No menu for this day yet. Create it first.');
    return toDailyMenu((await this.find(messId, date))!);
  }

  /** Copies one day's content to another date of the same mess, as a draft. */
  async copyDay(messId: string, date: string, dto: CopyMenuDto): Promise<DailyMenu> {
    if (dto.sourceDate === date) throw AppException.validation({ sourceDate: ['Choose a different day to copy from'] });
    const [source, existing] = await Promise.all([this.find(messId, dto.sourceDate), this.find(messId, date)]);
    if (!source) throw AppException.notFound(`There is no menu on ${dto.sourceDate} to copy`);
    if (existing && !dto.replace) {
      throw new AppException(HttpStatus.CONFLICT, ErrorCode.MENU_EXISTS, 'This day already has a menu. Confirm to replace it.');
    }
    const row = await this.writeDraftCopy(messId, date, source);
    return toDailyMenu(row);
  }

  /** Copies Mon–Sun of the previous week into the week containing `weekStart`. Existing days are skipped unless `replace`. */
  async copyWeek(messId: string, dto: CopyWeekDto): Promise<CopyWeekResult> {
    const target = startOfWeek(dto.weekStart);
    const source = addDays(target, -7);
    const [sourceRows, targetRows] = await Promise.all([
      this.prisma.dailyMenu.findMany({ where: { messId, menuDate: { gte: fromDateString(source), lte: fromDateString(addDays(source, 6)) } } }),
      this.prisma.dailyMenu.findMany({
        where: { messId, menuDate: { gte: fromDateString(target), lte: fromDateString(addDays(target, 6)) } },
        select: { menuDate: true },
      }),
    ]);
    const sourceByDate = new Map(sourceRows.map((r) => [toDateString(r.menuDate), r]));
    const existing = new Set(targetRows.map((r) => toDateString(r.menuDate)));

    const result: CopyWeekResult = { copied: [], skipped: [], failed: [] };
    for (const [i, date] of weekDates(target).entries()) {
      const from = sourceByDate.get(addDays(source, i));
      if (!from) {
        result.skipped.push({ date, reason: 'No menu on the same day last week' });
      } else if (existing.has(date) && !dto.replace) {
        result.skipped.push({ date, reason: 'Already has a menu' });
      } else {
        try {
          await this.writeDraftCopy(messId, date, from);
          result.copied.push(date);
        } catch {
          result.failed.push({ date, reason: 'Could not copy this day' });
        }
      }
    }
    return result;
  }

  /** Published menus of the student's own mess for today, tomorrow, or the next 7 days. Drafts never leave the server. */
  async forStudent(user: User, range: StudentMenuRange): Promise<StudentMenuResponse> {
    const student = await this.students.resolveSelf(user);
    if (!student) return { linked: false };

    const today = businessToday();
    const from = range === StudentMenuRange.TOMORROW ? addDays(today, 1) : today;
    const to = range === StudentMenuRange.WEEK ? addDays(today, 6) : from;
    const [mess, rows] = await Promise.all([
      this.prisma.mess.findUniqueOrThrow({
        where: { id: student.messId },
        select: { name: true, breakfastAvailable: true, lunchAvailable: true, dinnerAvailable: true },
      }),
      this.prisma.dailyMenu.findMany({
        where: { messId: student.messId, isPublished: true, menuDate: { gte: fromDateString(from), lte: fromDateString(to) } },
        orderBy: { menuDate: 'asc' },
      }),
    ]);
    return {
      linked: true,
      messName: mess.name,
      servedMeals: { breakfast: mess.breakfastAvailable, lunch: mess.lunchAvailable, dinner: mess.dinnerAvailable },
      days: this.fillDays(from, to, rows, toPublishedMenu),
    };
  }

  private writeDraftCopy(messId: string, date: string, source: MenuRow) {
    const data = { ...toContentData(toMenuInput(source)), ...DRAFT };
    return this.prisma.dailyMenu.upsert({
      where: { messId_menuDate: { messId, menuDate: fromDateString(date) } },
      create: { ...data, messId, menuDate: fromDateString(date) },
      update: data,
    });
  }

  private find(messId: string, date: string) {
    return this.prisma.dailyMenu.findUnique({ where: { messId_menuDate: { messId, menuDate: fromDateString(date) } } });
  }

  private fillDays<T>(from: string, to: string, rows: MenuRow[], map: (row: MenuRow) => T) {
    const byDate = new Map(rows.map((r) => [toDateString(r.menuDate), r]));
    const days: { date: string; menu: T | null }[] = [];
    for (let date = from; date <= to; date = addDays(date, 1)) {
      const row = byDate.get(date);
      days.push({ date, menu: row ? map(row) : null });
    }
    return days;
  }

  private assertRange(from: string, to: string) {
    const span = daysBetween(from, to) + 1;
    if (span < 1) throw AppException.validation({ to: ['"to" must be on or after "from"'] });
    if (span > MENU_LIMITS.rangeDays) throw AppException.validation({ to: [`Request at most ${MENU_LIMITS.rangeDays} days at a time`] });
  }
}
