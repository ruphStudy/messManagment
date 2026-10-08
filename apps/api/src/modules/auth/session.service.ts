import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { ClientType } from '@prisma/client';
import { ErrorCode } from '@mess/shared';
import { APP_CONFIG, AppConfig } from '../../config/app-config';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/http/app.exception';
import type { AccessTokenPayload } from '../../common/auth.types';
import { randomToken, safeEqualHex, sha256 } from './crypto.util';

/** Window in which the just-rotated refresh token is still accepted (parallel browser tabs). */
const ROTATION_GRACE_MS = 30_000;

export interface SessionMeta {
  clientType: ClientType;
  userAgent?: string;
  ipAddress?: string;
  persistent: boolean;
}

export interface IssuedSession {
  sessionId: string;
  accessToken: string;
  /** Undefined when a grace-period refresh reused the existing refresh token. */
  refreshToken?: string;
  persistent: boolean;
  expiresAt: Date;
}

/**
 * Refresh tokens look like `<sessionId>.<secret>`. Only sha256(secret) is stored.
 * Each refresh rotates the secret; presenting an old secret outside the grace window revokes the session.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async create(userId: string, meta: SessionMeta): Promise<IssuedSession> {
    const secret = randomToken();
    const ttlMs = meta.persistent
      ? this.config.refreshTtlDays * 86_400_000
      : this.config.refreshShortTtlHours * 3_600_000;
    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: sha256(secret),
        clientType: meta.clientType,
        persistent: meta.persistent,
        userAgent: meta.userAgent?.slice(0, 255),
        ipAddress: meta.ipAddress?.slice(0, 64),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });
    return this.issue(session.id, userId, `${session.id}.${secret}`, session.persistent, session.expiresAt);
  }

  async rotate(refreshToken: string) {
    const [sessionId, secret] = this.parse(refreshToken);
    const session = await this.prisma.session.findUnique({ where: { id: sessionId }, include: { user: true } });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) throw this.expired();

    const presented = sha256(secret);
    if (safeEqualHex(presented, session.refreshTokenHash)) {
      const nextSecret = randomToken();
      await this.prisma.session.update({
        where: { id: session.id },
        data: {
          refreshTokenHash: sha256(nextSecret),
          previousTokenHash: session.refreshTokenHash,
          rotatedAt: new Date(),
          lastUsedAt: new Date(),
        },
      });
      const issued = this.issue(session.id, session.userId, `${session.id}.${nextSecret}`, session.persistent, session.expiresAt);
      return { user: session.user, issued };
    }

    const withinGrace =
      session.previousTokenHash &&
      session.rotatedAt &&
      Date.now() - session.rotatedAt.getTime() < ROTATION_GRACE_MS &&
      safeEqualHex(presented, session.previousTokenHash);
    if (withinGrace) {
      return { user: session.user, issued: this.issue(session.id, session.userId, undefined, session.persistent, session.expiresAt) };
    }

    // An old token was replayed: assume it leaked and end the session.
    await this.revoke(session.id);
    throw this.expired();
  }

  /** Signs a user out everywhere (optionally keeping the session making the request). */
  async revokeAllForUser(userId: string, exceptSessionId?: string) {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      data: { revokedAt: new Date() },
    });
  }

  async revoke(sessionId: string) {
    await this.prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  /** Revokes the session a refresh token belongs to, if the token is genuine. */
  async revokeByToken(refreshToken: string) {
    let parsed: [string, string];
    try {
      parsed = this.parse(refreshToken);
    } catch {
      return;
    }
    const [sessionId, secret] = parsed;
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return;
    const presented = sha256(secret);
    const matches =
      safeEqualHex(presented, session.refreshTokenHash) ||
      (!!session.previousTokenHash && safeEqualHex(presented, session.previousTokenHash));
    if (matches) await this.revoke(session.id);
  }

  private issue(sessionId: string, userId: string, refreshToken: string | undefined, persistent: boolean, expiresAt: Date): IssuedSession {
    const payload: AccessTokenPayload = { sub: userId, sid: sessionId };
    const accessToken = this.jwt.sign(payload);
    return { sessionId, accessToken, refreshToken, persistent, expiresAt };
  }

  private parse(token: string): [string, string] {
    const [sessionId, secret] = token.split('.');
    if (!sessionId || !secret || !/^[0-9a-f-]{36}$/i.test(sessionId)) throw this.expired();
    return [sessionId, secret];
  }

  private expired() {
    return AppException.unauthorized('Your session has expired. Please sign in again.', ErrorCode.SESSION_EXPIRED);
  }
}
