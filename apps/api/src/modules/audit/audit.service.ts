import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuditAction, AuditLogItem, AuditTargetType } from '@mess/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { timestampRange } from '../../common/http/dates';
import { Paginated, PaginationQueryDto } from '../../common/http/pagination';

export interface AuditEntry {
  actorUserId: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  messId?: string | null;
  reason?: string | null;
  /** Human label of the target at the time (mess or user name) — never secrets. */
  label?: string | null;
}

export interface AuditFilters {
  actorUserId?: string;
  action?: AuditAction;
  targetType?: AuditTargetType;
  targetId?: string;
  messId?: string;
  from?: string;
  to?: string;
}

const include = {
  actor: { select: { id: true, firstName: true, lastName: true } },
  mess: { select: { id: true, name: true } },
} as const satisfies Prisma.AuditLogInclude;
type Row = Prisma.AuditLogGetPayload<{ include: typeof include }>;

const fullName = (p: { firstName: string; lastName: string | null }) => [p.firstName, p.lastName].filter(Boolean).join(' ');

function toItem(row: Row): AuditLogItem {
  const meta = (row.metadata ?? {}) as { label?: string };
  return {
    id: row.id,
    action: row.action as AuditAction,
    targetType: row.targetType as AuditTargetType,
    targetId: row.targetId,
    targetLabel: meta.label ?? null,
    mess: row.mess,
    actor: { id: row.actor.id, name: fullName(row.actor) },
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Append-only log of platform-admin actions. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Pass `tx` to write in the same transaction as the action it records. */
  async record(entry: AuditEntry, tx: Prisma.TransactionClient = this.prisma) {
    await tx.auditLog.create({
      data: {
        actorUserId: entry.actorUserId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        messId: entry.messId ?? null,
        reason: entry.reason ?? null,
        metadata: entry.label ? { label: entry.label } : undefined,
      },
    });
  }

  async list(filters: AuditFilters, page: PaginationQueryDto): Promise<Paginated<AuditLogItem>> {
    const where = this.where(filters);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({ where, include, orderBy: { createdAt: 'desc' }, skip: page.skip, take: page.pageSize }),
      this.prisma.auditLog.count({ where }),
    ]);
    return new Paginated(rows.map(toItem), total, page);
  }

  /** Latest entries matching `where` (detail pages). */
  async recent(where: Prisma.AuditLogWhereInput, take = 10): Promise<AuditLogItem[]> {
    const rows = await this.prisma.auditLog.findMany({ where, include, orderBy: { createdAt: 'desc' }, take });
    return rows.map(toItem);
  }

  /** Who suspended a target and why (latest suspension entry). */
  async lastSuspension(targetType: AuditTargetType, targetId: string, action: AuditAction) {
    const row = await this.prisma.auditLog.findFirst({ where: { targetType, targetId, action }, include, orderBy: { createdAt: 'desc' } });
    return row ? { reason: row.reason, at: row.createdAt.toISOString(), by: fullName(row.actor) } : null;
  }

  private where(f: AuditFilters): Prisma.AuditLogWhereInput {
    return {
      actorUserId: f.actorUserId,
      action: f.action,
      targetType: f.targetType,
      targetId: f.targetId,
      messId: f.messId,
      createdAt: timestampRange(f.from, f.to),
    };
  }
}
