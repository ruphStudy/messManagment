import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ErrorCode, OTP_LENGTH, RequestOtpResponse } from '@mess/shared';
import { APP_CONFIG, AppConfig } from '../../config/app-config';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/http/app.exception';
import { hmac, numericCode, safeEqualHex } from './crypto.util';
import { SMS_PROVIDER, SmsProvider } from './sms/sms.provider';

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  async issue(mobile: string): Promise<RequestOtpResponse> {
    const latest = await this.prisma.otpChallenge.findFirst({ where: { mobile }, orderBy: { createdAt: 'desc' } });
    if (latest) {
      const waitMs = latest.createdAt.getTime() + this.config.otpResendSeconds * 1000 - Date.now();
      if (waitMs > 0) {
        throw new AppException(
          HttpStatus.TOO_MANY_REQUESTS,
          ErrorCode.OTP_COOLDOWN,
          `Please wait ${Math.ceil(waitMs / 1000)} seconds before requesting a new code`,
        );
      }
    }

    const code = numericCode(OTP_LENGTH);
    await this.prisma.$transaction([
      this.prisma.otpChallenge.updateMany({ where: { mobile, consumedAt: null }, data: { consumedAt: new Date() } }),
      this.prisma.otpChallenge.create({
        data: {
          mobile,
          codeHash: this.hash(mobile, code),
          expiresAt: new Date(Date.now() + this.config.otpTtlSeconds * 1000),
        },
      }),
    ]);
    await this.sms.sendOtp(mobile, code);

    return {
      expiresIn: this.config.otpTtlSeconds,
      resendIn: this.config.otpResendSeconds,
      ...(this.config.otpDevEcho ? { devOtp: code } : {}),
    };
  }

  /** Throws unless the code matches the latest open challenge; consumes it on success. */
  async verify(mobile: string, code: string): Promise<void> {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { mobile, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge || challenge.expiresAt <= new Date()) {
      throw new AppException(HttpStatus.BAD_REQUEST, ErrorCode.OTP_EXPIRED, 'This code has expired. Request a new one.');
    }
    if (challenge.attempts >= this.config.otpMaxAttempts) {
      throw new AppException(HttpStatus.TOO_MANY_REQUESTS, ErrorCode.OTP_TOO_MANY_ATTEMPTS, 'Too many wrong attempts. Request a new code.');
    }

    if (!safeEqualHex(this.hash(mobile, code), challenge.codeHash)) {
      const updated = await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      const left = this.config.otpMaxAttempts - updated.attempts;
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        left > 0 ? ErrorCode.OTP_INVALID : ErrorCode.OTP_TOO_MANY_ATTEMPTS,
        left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many wrong attempts. Request a new code.',
      );
    }

    const { count } = await this.prisma.otpChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (count === 0) throw new AppException(HttpStatus.BAD_REQUEST, ErrorCode.OTP_EXPIRED, 'This code was already used');
  }

  private hash(mobile: string, code: string) {
    return hmac(this.config.jwtAccessSecret, `${mobile}:${code}`);
  }
}
