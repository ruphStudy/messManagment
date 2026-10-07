import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { ErrorCode } from '@mess/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/http/app.exception';
import type { ActiveMembership, RequestAuth } from '../../common/auth.types';

const membershipSelect = {
  id: true,
  messId: true,
  role: true,
  status: true,
  mess: { select: { id: true, name: true, status: true } },
} as const;

/** Resolves the live user, session and mess membership on every request so revocations apply immediately. */
@Injectable()
export class AuthContextService {
  constructor(private readonly prisma: PrismaService) {}

  async loadForSession(sessionId: string, userId: string): Promise<RequestAuth> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId }, include: { user: true } });
    if (!session || session.userId !== userId || session.revokedAt || session.expiresAt <= new Date()) {
      throw AppException.unauthorized('Your session has expired', ErrorCode.SESSION_EXPIRED);
    }
    return this.build(session.user, sessionId);
  }

  async build(user: User, sessionId: string): Promise<RequestAuth> {
    this.assertActive(user);
    const membership = await this.findActiveMembership(user.id);
    return { user, sessionId, membership, role: membership?.role ?? user.role };
  }

  assertActive(user: User) {
    if (user.status !== 'ACTIVE') {
      throw AppException.forbidden('Your account is disabled. Please contact support.', ErrorCode.ACCOUNT_DISABLED);
    }
  }

  /** MVP: a user works in one mess at a time — the earliest active membership. */
  findActiveMembership(userId: string): Promise<ActiveMembership | null> {
    return this.prisma.messMembership.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: membershipSelect,
    });
  }
}
