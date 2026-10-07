import { Injectable, Logger } from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import { ErrorCode, Role } from '@mess/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/http/app.exception';

/**
 * The only place that connects mess student records to platform login accounts.
 *
 * - Owner adds a student whose mobile already has an app account → link to that account (no new user).
 * - Owner adds a student with no app account → record stays unlinked until that mobile signs in.
 * - Student signs in with OTP → every unlinked record with that verified mobile is linked.
 *   (messId, mobile) is unique, so there is at most one candidate per mess and nothing is guessed.
 * - Records already linked to an account are never reassigned here.
 */
@Injectable()
export class StudentLinkService {
  private readonly logger = new Logger(StudentLinkService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** The app account to link for a mobile, or null when none exists yet. Team accounts are a conflict. */
  async resolveUserId(mobile: string, db: Prisma.TransactionClient = this.prisma): Promise<string | null> {
    const user = await db.user.findUnique({ where: { mobile }, select: { id: true, role: true } });
    if (!user) return null;
    if (user.role !== Role.STUDENT) {
      throw AppException.conflict(
        'This mobile number belongs to a mess team account',
        { mobile: ['This number is used by an owner or staff account. Use a different number.'] },
        ErrorCode.MOBILE_IN_USE,
      );
    }
    return user.id;
  }

  /** Links unlinked student records to a student who has proven ownership of the mobile via OTP. */
  async linkUser(user: Pick<User, 'id' | 'mobile' | 'role'>): Promise<number> {
    if (user.role !== Role.STUDENT) return 0;
    try {
      const { count } = await this.prisma.messStudent.updateMany({
        where: { mobile: user.mobile, userId: null },
        data: { userId: user.id },
      });
      return count;
    } catch (error) {
      // Never block sign-in because of a linking problem; the records stay unlinked for review.
      this.logger.warn(`Could not link student records for user ${user.id}: ${(error as Error).message}`);
      return 0;
    }
  }
}
