import { HttpStatus, Injectable } from '@nestjs/common';
import { ComplaintStatus, MessageAuthor, NotificationType, Prisma, type User } from '@prisma/client';
import {
  type AdminComplaintDetail,
  type AdminComplaintItem,
  canTransition,
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_STATUS_LABELS,
  ErrorCode,
  NotificationScreen,
  type ComplaintCounts,
  type ComplaintDetail,
  type ComplaintListItem,
  type ComplaintSummaryItem,
  type StudentComplaintDetail,
} from '@mess/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/http/app.exception';
import { fromDateString } from '../../common/http/dates';
import { Paginated } from '../../common/http/pagination';
import { FilesService } from '../files/files.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StudentsService } from '../students/students.service';
import { studentSearchTerms } from '../students/student-search';
import { ComplaintResponseDto, CreateComplaintDto, ListComplaintsQueryDto, StudentComplaintsQueryDto } from './dto/complaint.dto';

const personName = (u: { firstName: string; lastName: string | null } | null) => (u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || null : null);

const listInclude = {
  student: { select: { id: true, firstName: true, lastName: true, mobile: true } },
  _count: { select: { messages: true } },
  messages: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
} as const satisfies Prisma.ComplaintInclude;
type ListRow = Prisma.ComplaintGetPayload<{ include: typeof listInclude }>;

const detailInclude = {
  ...listInclude,
  resolvedBy: { select: { firstName: true, lastName: true } },
  messages: { orderBy: { createdAt: 'asc' }, include: { user: { select: { firstName: true, lastName: true } } } },
} as const satisfies Prisma.ComplaintInclude;
type DetailRow = Prisma.ComplaintGetPayload<{ include: typeof detailInclude }>;

function toSummary(row: ListRow | DetailRow): ComplaintSummaryItem {
  // List rows carry only the latest message, detail rows all of them; either way take the newest.
  const last = row.messages.reduce<Date | null>((max, m) => (!max || m.createdAt > max ? m.createdAt : max), null);
  return {
    id: row.id,
    category: row.category,
    description: row.description,
    status: row.status,
    hasAttachment: !!row.attachmentId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    responseCount: row._count.messages,
    lastResponseAt: last?.toISOString() ?? null,
  };
}

function toDetail(row: DetailRow): ComplaintDetail {
  return {
    ...toSummary(row),
    student: row.student,
    attachmentId: row.attachmentId,
    inProgressAt: row.inProgressAt?.toISOString() ?? null,
    resolvedBy: personName(row.resolvedBy),
    messages: row.messages.map((m) => ({
      id: m.id,
      author: m.author,
      // Students see "Mess" replies by name of the person who answered; harmless and reassuring.
      authorName: personName(m.user),
      message: m.message,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

/**
 * Complaints: student raises → team moves OPEN → IN_PROGRESS → RESOLVED (rules in shared COMPLAINT_TRANSITIONS).
 * Replies are append-only and closed once resolved. Nothing is ever deleted. Notifications are best-effort.
 */
@Injectable()
export class ComplaintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly students: StudentsService,
    private readonly files: FilesService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Student ──

  async create(user: User, dto: CreateComplaintDto): Promise<StudentComplaintDetail> {
    const student = await this.students.resolveSelf(user);
    if (!student) throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.STUDENT_NOT_LINKED, 'Your mess has not linked your mobile number yet');

    if (dto.idempotencyKey) {
      const existing = await this.prisma.complaint.findUnique({ where: { studentId_idempotencyKey: { studentId: student.id, idempotencyKey: dto.idempotencyKey } }, select: { id: true } });
      if (existing) return this.studentDetail(user, existing.id);
    }
    if (dto.attachmentId) await this.files.requireAttachable(user.id, student.messId, dto.attachmentId);

    let id: string;
    try {
      ({ id } = await this.prisma.complaint.create({
        data: {
          messId: student.messId,
          studentId: student.id,
          category: dto.category,
          description: dto.description,
          attachmentId: dto.attachmentId ?? null,
          idempotencyKey: dto.idempotencyKey ?? null,
        },
        select: { id: true },
      }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && dto.idempotencyKey) {
        const existing = await this.prisma.complaint.findFirstOrThrow({ where: { studentId: student.id, idempotencyKey: dto.idempotencyKey }, select: { id: true } });
        return this.studentDetail(user, existing.id);
      }
      throw error;
    }

    const name = [student.firstName, student.lastName].filter(Boolean).join(' ');
    await this.notifications.notifySafely(await this.notifications.teamTargets(student.messId), {
      type: NotificationType.COMPLAINT_CREATED,
      title: `New complaint: ${COMPLAINT_CATEGORY_LABELS[dto.category]}`,
      body: `${name || 'A student'}: ${dto.description}`,
      data: { screen: NotificationScreen.COMPLAINT, complaintId: id },
    });
    return this.studentDetail(user, id);
  }

  async listMine(user: User, query: StudentComplaintsQueryDto) {
    const student = await this.students.resolveSelf(user);
    if (!student) return new Paginated([], 0, query);
    const where = { studentId: student.id, status: query.status };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.complaint.findMany({ where, include: listInclude, orderBy: { createdAt: 'desc' }, skip: query.skip, take: query.pageSize }),
      this.prisma.complaint.count({ where }),
    ]);
    return new Paginated(rows.map(toSummary), total, query);
  }

  async studentDetail(user: User, id: string): Promise<StudentComplaintDetail> {
    const student = await this.students.resolveSelf(user);
    const row = student && (await this.prisma.complaint.findFirst({ where: { id, studentId: student.id }, include: detailInclude }));
    if (!row) throw this.notFound();
    const { student: _s, ...detail } = toDetail(row);
    return detail;
  }

  // ── Mess team ──

  private listWhere(messId: string, query: Omit<ListComplaintsQueryDto, 'skip' | 'page' | 'pageSize'>): Prisma.ComplaintWhereInput {
    return {
      messId,
      status: query.status,
      category: query.category,
      createdAt: {
        ...(query.from ? { gte: fromDateString(query.from) } : {}),
        // `to` is inclusive of that whole (UTC-stored) day.
        ...(query.to ? { lt: new Date(fromDateString(query.to).getTime() + 86_400_000) } : {}),
      },
      ...(query.search ? { student: { AND: studentSearchTerms(query.search) } } : {}),
    };
  }

  async list(messId: string, query: ListComplaintsQueryDto) {
    const where = this.listWhere(messId, query);
    const [rows, total] = await this.prisma.$transaction([
      // Open first, then in progress, then resolved; newest first within each.
      this.prisma.complaint.findMany({ where, include: listInclude, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], skip: query.skip, take: query.pageSize }),
      this.prisma.complaint.count({ where }),
    ]);
    return new Paginated(rows.map((r): ComplaintListItem => ({ ...toSummary(r), student: r.student })), total, query);
  }

  /** Per-status counts; with filters (reports) the status filter itself is ignored so all three show. */
  async counts(messId: string, filters: Partial<ListComplaintsQueryDto> = {}): Promise<ComplaintCounts> {
    const groups = await this.prisma.complaint.groupBy({ by: ['status'], where: this.listWhere(messId, { ...filters, status: undefined }), _count: { _all: true } });
    const count = (s: ComplaintStatus) => groups.find((g) => g.status === s)?._count._all ?? 0;
    return { OPEN: count(ComplaintStatus.OPEN), IN_PROGRESS: count(ComplaintStatus.IN_PROGRESS), RESOLVED: count(ComplaintStatus.RESOLVED) };
  }

  async detail(messId: string, id: string): Promise<ComplaintDetail> {
    const row = await this.prisma.complaint.findFirst({ where: { id, messId }, include: detailInclude });
    if (!row) throw this.notFound();
    return toDetail(row);
  }

  async setStatus(messId: string, userId: string, id: string, status: ComplaintStatus): Promise<ComplaintDetail> {
    const current = await this.prisma.complaint.findFirst({ where: { id, messId }, select: { status: true } });
    if (!current) throw this.notFound();
    if (!canTransition(current.status, status)) {
      throw current.status === ComplaintStatus.RESOLVED
        ? this.alreadyResolved()
        : new AppException(HttpStatus.CONFLICT, ErrorCode.COMPLAINT_STATUS_INVALID, `Cannot change from ${COMPLAINT_STATUS_LABELS[current.status]} to ${COMPLAINT_STATUS_LABELS[status]}`);
    }
    const resolved = status === ComplaintStatus.RESOLVED;
    // Conditional update: a concurrent change makes this a no-op instead of a double transition.
    const { count } = await this.prisma.complaint.updateMany({
      where: { id, messId, status: current.status },
      data: { status, ...(resolved ? { resolvedAt: new Date(), resolvedById: userId } : { inProgressAt: new Date() }) },
    });
    if (count === 0) throw new AppException(HttpStatus.CONFLICT, ErrorCode.COMPLAINT_STATUS_INVALID, 'This complaint was just updated. Refresh and try again.');

    const detail = await this.detail(messId, id);
    await this.notifyStudent(id, resolved ? 'Your complaint is resolved' : 'Your complaint is being looked into', `${COMPLAINT_CATEGORY_LABELS[detail.category]}: ${resolved ? 'marked resolved' : 'the mess has started working on it'}.`);
    return detail;
  }

  async respond(messId: string, userId: string, id: string, dto: ComplaintResponseDto): Promise<ComplaintDetail> {
    const current = await this.prisma.complaint.findFirst({ where: { id, messId }, select: { status: true } });
    if (!current) throw this.notFound();
    if (current.status === ComplaintStatus.RESOLVED) throw this.alreadyResolved();
    await this.prisma.$transaction([
      this.prisma.complaintMessage.create({ data: { complaintId: id, authorId: userId, author: MessageAuthor.MESS, message: dto.message } }),
      // Touch updatedAt so the student's list shows recent activity.
      this.prisma.complaint.update({ where: { id }, data: { updatedAt: new Date() } }),
    ]);
    await this.notifyStudent(id, 'New reply on your complaint', dto.message);
    return this.detail(messId, id);
  }

  private async notifyStudent(complaintId: string, title: string, body: string) {
    const row = await this.prisma.complaint.findUnique({ where: { id: complaintId }, select: { messId: true, student: { select: { userId: true } } } });
    if (!row?.student.userId) return;
    await this.notifications.notifySafely([{ userId: row.student.userId, messId: row.messId }], {
      type: NotificationType.COMPLAINT_UPDATED,
      title,
      body,
      data: { screen: NotificationScreen.COMPLAINT, complaintId },
    });
  }

  // ── Platform admin (read-only, cross-mess) ──

  /** Same filters as the mess list, across all messes (or one), newest first. */
  async listForPlatform(query: ListComplaintsQueryDto & { messId?: string }) {
    // Build the normal mess filter, then swap the tenant condition for the admin's optional mess filter.
    const { messId: _tenant, ...rest } = this.listWhere('', query);
    const where: Prisma.ComplaintWhereInput = { ...rest, ...(query.messId ? { messId: query.messId } : {}) };
    const include = { ...listInclude, mess: { select: { id: true, name: true } } } as const;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.complaint.findMany({ where, include, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: query.skip, take: query.pageSize }),
      this.prisma.complaint.count({ where }),
    ]);
    return new Paginated(rows.map((r): AdminComplaintItem => ({ ...toSummary(r), student: r.student, mess: r.mess })), total, query);
  }

  /** Conversation and status history only; the photo stays with the mess (attachment id is not exposed). */
  async detailForPlatform(id: string): Promise<AdminComplaintDetail> {
    const row = await this.prisma.complaint.findUnique({ where: { id }, include: { ...detailInclude, mess: { select: { id: true, name: true } } } });
    if (!row) throw this.notFound();
    const { attachmentId: _photo, ...detail } = toDetail(row);
    return { ...detail, mess: row.mess };
  }

  private alreadyResolved() {
    return new AppException(HttpStatus.CONFLICT, ErrorCode.COMPLAINT_ALREADY_RESOLVED, 'This complaint is already resolved');
  }

  private notFound() {
    return new AppException(HttpStatus.NOT_FOUND, ErrorCode.COMPLAINT_NOT_FOUND, 'Complaint not found');
  }
}
