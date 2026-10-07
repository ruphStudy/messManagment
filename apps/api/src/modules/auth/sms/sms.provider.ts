import { Logger } from '@nestjs/common';

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

/** Implement this for a real SMS gateway and bind it in AuthModule; the OTP flow does not change. */
export interface SmsProvider {
  sendOtp(mobile: string, code: string): Promise<void>;
}

/** Development provider: writes the OTP to the server log. Refused at startup in production. */
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger('ConsoleSms');

  async sendOtp(mobile: string, code: string) {
    this.logger.log(`OTP for ${mobile}: ${code}`);
  }
}
