import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_CONFIG, AppConfig } from '../../config/app-config';
import { AuthContextService } from './auth-context.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { SessionService } from './session.service';
import { ConsoleSmsProvider, SMS_PROVIDER } from './sms/sms.provider';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        secret: config.jwtAccessSecret,
        signOptions: { expiresIn: config.jwtAccessTtlSeconds },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthContextService,
    SessionService,
    OtpService,
    { provide: SMS_PROVIDER, useClass: ConsoleSmsProvider },
  ],
  exports: [AuthContextService],
})
export class AuthModule {}
