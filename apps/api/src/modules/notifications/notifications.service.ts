import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma, type NotificationType } from '@prisma/client';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  ErrorCode,
  NOTIFICATION_LIMITS,
  PREFERENCE_FOR_TYPE,
  PushStatus,
  type AppNotification,
  type NotificationData,
  type NotificationPreferences,
} from '@mess/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/http/app.exception';
import { Paginated } from '../../common/http/pagination';
import { ListNotificationsQueryDto } from './dto/notification.dto';
import { PUSH_PROVIDER, type PushProvider } from './push/push.provider';

export interface NotificationContent {
  type: NotificationType;
  title: string;
  body: string;
  data?: NotificationData;
  /** Optional: who triggered it (manual reminders). */
  createdById?: string;
}

export interface NotifyTarget {
  userId: string;
  messId: string | null;
  /** Same key for the same user is stored once. */
  dedupeKey?: string;
}

export interface NotifyResult {
  createdUserIds: string[];
  /** Turned off by the user's preference for this type. */
  optedOutUserIds: string[];
  /** Already had a notification with this dedupe key. */
  duplicateUserIds: string[];
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/**
 * The one place notifications are created. In-app rows are the source of truth; push is sent afterwards
 * in the background and its failure never affects the caller.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUSH_PROVIDER) private readonly push: PushProvider,
  ) {}

  async notify(targets: NotifyTarget[], content: NotificationContent): Promise<NotifyResult> {
    const result: NotifyResult = { createdUserIds: [], optedOutUserIds: [], duplicateUserIds: [] };
    if (!targets.length) return result;

    const preferenceKey = PREFERENCE_FOR_TYPE[content.type];
    const prefs = await this.preferencesFor(targets.map((t) => t.userId));
    const allowed = targets.filter((t) => {
      if (preferenceKey && !prefs.get(t.userId)![preferenceKey]) {
        result.optedOutUserIds.push(t.userId);
        return false;
      }
      return true;
    });
    if (!allowed.length) return result;

    const wantsPush = (userId: string) => prefs.get(userId)!.pushEnabled;
    const rows = await this.prisma.notification.createManyAndReturn({
      data: allowed.map((t) => ({
        messId: t.messId,
        userId: t.userId,
        type: content.type,
        title: clip(content.title, NOTIFICATION_LIMITS.titleMax),
        body: clip(content.body, NOTIFICATION_LIMITS.bodyMax),
        data: (content.data ?? undefined) as Prisma.InputJsonValue | undefined,
        dedupeKey: t.dedupeKey ?? null,
        createdById: content.createdById ?? null,
        pushStatus: wantsPush(t.userId) ? PushStatus.PENDING : PushStatus.NOT_SENT,
      })),
      skipDuplicates: true,
      select: { id: true, userId: true, title: true, body: true, data: true, pushStatus: true, messId: true },
    });
    const created = new Set(rows.map((r) => r.userId));
    result.createdUserIds = [...created];
    result.duplicateUserIds = allowed.filter((t) => !created.has(t.userId)).map((t) => t.userId);

    void this.deliverPush(rows.filter((r) => r.pushStatus === PushStatus.PENDING));
    return result;
  }

  /** For side effects of business actions: never throws, only logs. */
  async notifySafely(targets: NotifyTarget[], content: NotificationContent): Promise<NotifyResult | null> {
    try {
      return await this.notify(targets, content);
    } catch (error) {
      this.logger.error(`Could not create ${content.type} notifications: ${(error as Error).message}`);
      return null;
    }
  }

  /** Background push; marks each notification SENT / FAILED and deactivates unregistered devices. */
  private async deliverPush(rows: { id: string; userId: string; title: string; body: string; data: Prisma.JsonValue; messId: string | null }[]) {
    if (!rows.length) return;
    try {
      const devices = await this.prisma.pushDevice.findMany({
        where: { userId: { in: [...new Set(rows.map((r) => r.userId))] }, isActive: true },
        select: { id: true, userId: true, pushToken: true },
      });
      const messages = rows.flatMap((r) =>
        devices
          .filter((d) => d.userId === r.userId)
          .map((d) => ({ row: r, device: d, message: { to: d.pushToken, title: r.title, body: r.body, data: { ...((r.data as object) ?? {}), notificationId: r.id, ...(r.messId ? { messId: r.messId } : {}) } } })),
      );
      const results = messages.length ? await this.push.send(messages.map((m) => m.message)) : [];

      const sent = new Set<string>();
      const gone: string[] = [];
      results.forEach((res, i) => {
        if (res.ok) sent.add(messages[i].row.id);
        else if (res.deviceGone) gone.push(messages[i].device.id);
      });
      const failed = rows.map((r) => r.id).filter((id) => !sent.has(id));
      // No devices at all → nothing was attempted for that row.
      const attempted = new Set(messages.map((m) => m.row.id));
      await this.prisma.$transaction([
        this.prisma.notification.updateMany({ where: { id: { in: [...sent] } }, data: { pushStatus: PushStatus.SENT } }),
        this.prisma.notification.updateMany({ where: { id: { in: failed.filter((id) => attempted.has(id)) } }, data: { pushStatus: PushStatus.FAILED } }),
        this.prisma.notification.updateMany({ where: { id: { in: failed.filter((id) => !attempted.has(id)) } }, data: { pushStatus: PushStatus.NOT_SENT } }),
        this.prisma.pushDevice.updateMany({ where: { id: { in: gone } }, data: { isActive: false } }),
      ]);
    } catch (error) {
      this.logger.warn(`Push delivery error: ${(error as Error).message}`);
      await this.prisma.notification
        .updateMany({ where: { id: { in: rows.map((r) => r.id) }, pushStatus: PushStatus.PENDING }, data: { pushStatus: PushStatus.FAILED } })
        .catch(() => undefined);
    }
  }

  /** App users who are ACTIVE students of a mess (students not on the app yet are left out). */
  async activeStudentTargets(messId: string, dedupeKey?: string): Promise<NotifyTarget[]> {
    const students = await this.prisma.messStudent.findMany({
      where: { messId, status: 'ACTIVE', userId: { not: null } },
      select: { userId: true },
    });
    return students.map((s) => ({ userId: s.userId!, messId, dedupeKey }));
  }

  /** Owner + managers of a mess (for operational notices). */
  async teamTargets(messId: string, dedupeKey?: string): Promise<NotifyTarget[]> {
    const members = await this.prisma.messMembership.findMany({
      where: { messId, status: 'ACTIVE', role: { in: ['MESS_OWNER', 'MESS_MANAGER'] } },
      select: { userId: true },
    });
    return members.map((m) => ({ userId: m.userId, messId, dedupeKey }));
  }

  // ── Recipient side (always scoped to the signed-in user) ──

  async list(userId: string, query: ListNotificationsQueryDto) {
    const where: Prisma.NotificationWhereInput = { userId, type: query.type, ...(query.unreadOnly ? { readAt: null } : {}) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: query.skip, take: query.pageSize }),
      this.prisma.notification.count({ where }),
    ]);
    return new Paginated(rows.map(toAppNotification), total, query);
  }

  async unreadCount(userId: string) {
    return { count: await this.prisma.notification.count({ where: { userId, readAt: null } }) };
  }

  /** Idempotent: reading an already-read notification keeps its first read time. */
  async markRead(userId: string, id: string): Promise<AppNotification> {
    await this.prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
    const row = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!row) throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.NOTIFICATION_NOT_FOUND, 'Notification not found');
    return toAppNotification(row);
  }

  async markAllRead(userId: string) {
    const { count } = await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { updated: count };
  }

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    return (await this.preferencesFor([userId])).get(userId)!;
  }

  async updatePreferences(userId: string, patch: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const row = await this.prisma.notificationPreference.upsert({ where: { userId }, create: { userId, ...patch }, update: patch });
    const { userId: _u, updatedAt: _t, ...prefs } = row;
    return prefs;
  }

  private async preferencesFor(userIds: string[]) {
    const rows = await this.prisma.notificationPreference.findMany({ where: { userId: { in: userIds } } });
    const map = new Map<string, NotificationPreferences>(userIds.map((id) => [id, { ...DEFAULT_NOTIFICATION_PREFERENCES }]));
    for (const { userId, updatedAt: _t, ...prefs } of rows) map.set(userId, prefs);
    return map;
  }
}

export function toAppNotification(row: { id: string; type: NotificationType; title: string; body: string; data: Prisma.JsonValue; readAt: Date | null; createdAt: Date; messId: string | null }): AppNotification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    data: (row.data as NotificationData | null) ?? null,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    messId: row.messId,
  };
}
