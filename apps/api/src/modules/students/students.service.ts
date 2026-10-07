import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import {
  ErrorCode,
  normalizeMobile,
  StudentStatus,
  type StudentDetail,
  type StudentListItem,
  type StudentMeResponse,
  type StudentSelfProfile,
  type ToggleableStudentStatus,
} from '@mess/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/http/app.exception';
import { Paginated } from '../../common/http/pagination';
import { CreateStudentDto, ListStudentsQueryDto, UpdateStudentDto, UpdateStudentSelfDto } from './dto/student.dto';
import { StudentLinkService } from './student-link.service';
import {
  fromDateString,
  studentListSelect,
  toStudentDetail,
  toStudentListItem,
  toStudentSelfProfile,
} from './student.mapper';

const detailInclude = { user: { select: { lastLoginAt: true } } } as const;
const selfInclude = { mess: { select: { id: true, name: true, mobile: true, city: true } } } as const;
const NOT_ARCHIVED = { not: StudentStatus.ARCHIVED };

/**
 * Mess-scoped student management. Every query filters by the caller's messId (from their membership),
 * so records of another mess are indistinguishable from records that do not exist.
 */
@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly linker: StudentLinkService,
  ) {}

  async list(messId: string, query: ListStudentsQueryDto): Promise<Paginated<StudentListItem>> {
    const where: Prisma.MessStudentWhereInput = {
      messId,
      status: query.status ?? NOT_ARCHIVED,
      AND: this.searchTerms(query.search),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.messStudent.findMany({
        where,
        select: studentListSelect,
        orderBy: this.orderBy(query),
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.messStudent.count({ where }),
    ]);
    return new Paginated(rows.map(toStudentListItem), total, query);
  }

  async get(messId: string, id: string): Promise<StudentDetail> {
    const student = await this.prisma.messStudent.findFirst({ where: { id, messId }, include: detailInclude });
    if (!student) throw this.notFound();
    return toStudentDetail(student);
  }

  async create(messId: string, dto: CreateStudentDto): Promise<StudentDetail> {
    await this.assertMobileAvailable(messId, dto.mobile);
    const userId = await this.linker.resolveUserId(dto.mobile);
    try {
      const student = await this.prisma.messStudent.create({
        data: { ...dto, joiningDate: fromDateString(dto.joiningDate), messId, userId },
        include: detailInclude,
      });
      return toStudentDetail(student);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async update(messId: string, id: string, dto: UpdateStudentDto): Promise<StudentDetail> {
    const current = await this.prisma.messStudent.findFirst({ where: { id, messId }, select: { mobile: true, status: true } });
    if (!current) throw this.notFound();
    if (current.status === StudentStatus.ARCHIVED) throw this.archivedConflict('Restore this student before editing');

    const { joiningDate, ...fields } = dto;
    const data: Prisma.MessStudentUncheckedUpdateInput = {
      ...fields,
      ...(joiningDate ? { joiningDate: fromDateString(joiningDate) } : {}),
    };
    // A new number belongs to whoever owns it on the platform; the old account no longer matches this record.
    if (dto.mobile && dto.mobile !== current.mobile) {
      await this.assertMobileAvailable(messId, dto.mobile);
      data.userId = await this.linker.resolveUserId(dto.mobile);
    }

    try {
      const student = await this.prisma.messStudent.update({ where: { id, messId }, data, include: detailInclude });
      return toStudentDetail(student);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async setStatus(messId: string, id: string, status: ToggleableStudentStatus): Promise<StudentDetail> {
    const { count } = await this.prisma.messStudent.updateMany({
      where: { id, messId, status: NOT_ARCHIVED },
      data: { status },
    });
    if (count === 0) await this.explainMissing(messId, id, 'Restore this student before changing their status');
    return this.get(messId, id);
  }

  /** Soft archive: hides the student from normal lists. The record and any linked app account are kept. */
  async archive(messId: string, id: string): Promise<StudentDetail> {
    const { count } = await this.prisma.messStudent.updateMany({
      where: { id, messId, status: NOT_ARCHIVED },
      data: { status: StudentStatus.ARCHIVED, archivedAt: new Date() },
    });
    if (count === 0) await this.explainMissing(messId, id, 'This student is already archived');
    return this.get(messId, id);
  }

  async restore(messId: string, id: string): Promise<StudentDetail> {
    const { count } = await this.prisma.messStudent.updateMany({
      where: { id, messId, status: StudentStatus.ARCHIVED },
      data: { status: StudentStatus.ACTIVE, archivedAt: null },
    });
    if (count === 0) {
      const exists = await this.prisma.messStudent.count({ where: { id, messId } });
      if (!exists) throw this.notFound();
      throw AppException.conflict('This student is not archived');
    }
    return this.get(messId, id);
  }

  /** The signed-in student's own record. Links pending records first, so a just-added student appears immediately. */
  async getSelf(user: User): Promise<StudentMeResponse> {
    await this.linker.linkUser(user);
    const student = await this.findSelf(user.id);
    return student ? { linked: true, profile: toStudentSelfProfile(student) } : { linked: false };
  }

  async updateSelf(user: User, dto: UpdateStudentSelfDto): Promise<StudentSelfProfile> {
    const current = await this.findSelf(user.id);
    if (!current) {
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.STUDENT_NOT_LINKED, 'Your mess has not linked your mobile number yet');
    }
    const student = await this.prisma.messStudent.update({
      where: { id: current.id, userId: user.id },
      data: dto,
      include: selfInclude,
    });
    return toStudentSelfProfile(student);
  }

  /** Active record first, then inactive; most recent joining wins if the student is in several messes. */
  private findSelf(userId: string) {
    return this.prisma.messStudent.findFirst({
      where: { userId, status: NOT_ARCHIVED },
      orderBy: [{ status: 'asc' }, { joiningDate: 'desc' }],
      include: selfInclude,
    });
  }

  private async assertMobileAvailable(messId: string, mobile: string) {
    const existing = await this.prisma.messStudent.findUnique({
      where: { messId_mobile: { messId, mobile } },
      select: { status: true },
    });
    if (!existing) return;
    if (existing.status === StudentStatus.ARCHIVED) {
      throw this.archivedConflict('An archived student has this mobile number. Restore them instead of adding again.', {
        mobile: ['Belongs to an archived student'],
      });
    }
    throw AppException.conflict(
      'A student with this mobile number is already added',
      { mobile: ['Already added to your mess'] },
      ErrorCode.STUDENT_DUPLICATE,
    );
  }

  private async explainMissing(messId: string, id: string, archivedMessage: string): Promise<never> {
    const exists = await this.prisma.messStudent.count({ where: { id, messId } });
    if (!exists) throw this.notFound();
    throw this.archivedConflict(archivedMessage);
  }

  /** Each word must match at least one searchable field (so "raj pune" narrows results). */
  private searchTerms(search?: string): Prisma.MessStudentWhereInput[] {
    if (!search) return [];
    return search
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 5)
      .map((term) => {
        const contains = { contains: term, mode: 'insensitive' as const };
        const digits = normalizeMobile(term) ?? term.replace(/\D/g, '');
        return {
          OR: [
            { firstName: contains },
            { lastName: contains },
            { email: contains },
            { collegeName: contains },
            { hostelOrPg: contains },
            ...(digits.length >= 3 ? [{ mobile: { contains: digits } }] : []),
          ],
        };
      });
  }

  private orderBy({ sortBy, sortOrder }: ListStudentsQueryDto): Prisma.MessStudentOrderByWithRelationInput[] {
    const tiebreak = { id: sortOrder };
    switch (sortBy) {
      case 'name':
        return [{ firstName: sortOrder }, { lastName: sortOrder }, tiebreak];
      case 'joiningDate':
        return [{ joiningDate: sortOrder }, { createdAt: 'desc' }, tiebreak];
      default:
        return [{ createdAt: sortOrder }, tiebreak];
    }
  }

  private mapWriteError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return AppException.conflict('A student with this mobile number is already added', { mobile: ['Already added to your mess'] }, ErrorCode.STUDENT_DUPLICATE);
      }
      if (error.code === 'P2025') return this.notFound();
    }
    return error;
  }

  private archivedConflict(message: string, fields?: Record<string, string[]>) {
    return AppException.conflict(message, fields, ErrorCode.STUDENT_ARCHIVED);
  }

  private notFound() {
    return AppException.notFound('Student not found');
  }
}
