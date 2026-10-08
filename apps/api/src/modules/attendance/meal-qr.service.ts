import { Inject, Injectable } from '@nestjs/common';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { ErrorCode, MEAL_QR_TTL_SECONDS } from '@mess/shared';
import { APP_CONFIG, AppConfig } from '../../config/app-config';

const AUDIENCE = 'meal-qr';

interface MealQrClaims {
  /** MessStudent id (signed, never trusted unless the signature verifies). */
  sid: string;
  /** Mess the QR was issued for; the scanner's mess must match. */
  mid: string;
}

export type QrVerification = { ok: true; studentId: string; messId: string } | { ok: false; reason: ErrorCode };

/**
 * Short-lived signed meal QR tokens. Uses a key derived from the API secret plus a dedicated audience,
 * so access tokens can't be used as QR codes and vice versa.
 */
@Injectable()
export class MealQrService {
  private readonly secret: string;

  constructor(
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.secret = `${config.jwtAccessSecret}:meal-qr`;
  }

  issue(student: { id: string; messId: string }) {
    const claims: MealQrClaims = { sid: student.id, mid: student.messId };
    const token = this.jwt.sign(claims, { secret: this.secret, audience: AUDIENCE, expiresIn: MEAL_QR_TTL_SECONDS });
    return { token, expiresAt: new Date(Date.now() + MEAL_QR_TTL_SECONDS * 1000), expiresIn: MEAL_QR_TTL_SECONDS };
  }

  verify(token: string): QrVerification {
    try {
      const claims = this.jwt.verify<MealQrClaims>(token, { secret: this.secret, audience: AUDIENCE, algorithms: ['HS256'] });
      if (typeof claims.sid !== 'string' || typeof claims.mid !== 'string') return { ok: false, reason: ErrorCode.QR_INVALID };
      return { ok: true, studentId: claims.sid, messId: claims.mid };
    } catch (error) {
      return { ok: false, reason: error instanceof TokenExpiredError ? ErrorCode.QR_EXPIRED : ErrorCode.QR_INVALID };
    }
  }
}
