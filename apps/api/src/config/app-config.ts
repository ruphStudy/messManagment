export interface AppConfig {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  corsOrigins: string[];
  jwtAccessSecret: string;
  jwtAccessTtlSeconds: number;
  refreshTtlDays: number;
  refreshShortTtlHours: number;
  smsProvider: 'console';
  otpTtlSeconds: number;
  otpResendSeconds: number;
  otpMaxAttempts: number;
  otpDevEcho: boolean;
}

export const APP_CONFIG = Symbol('APP_CONFIG');

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

/** Reads and validates environment configuration once at startup. */
export function loadConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';
  required('DATABASE_URL');

  const jwtAccessSecret = required('JWT_ACCESS_SECRET');
  if (jwtAccessSecret.length < 32) throw new Error('JWT_ACCESS_SECRET must be at least 32 characters');

  const smsProvider = process.env.SMS_PROVIDER ?? 'console';
  if (smsProvider !== 'console') throw new Error(`Unsupported SMS_PROVIDER "${smsProvider}"`);
  if (isProduction && smsProvider === 'console') {
    throw new Error('SMS_PROVIDER=console is for development only. Configure a real SMS provider for production.');
  }

  return {
    nodeEnv,
    isProduction,
    port: int('PORT', 4100),
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3100')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    jwtAccessSecret,
    jwtAccessTtlSeconds: int('JWT_ACCESS_TTL_SECONDS', 900),
    refreshTtlDays: int('REFRESH_TTL_DAYS', 30),
    refreshShortTtlHours: int('REFRESH_SHORT_TTL_HOURS', 12),
    smsProvider,
    otpTtlSeconds: int('OTP_TTL_SECONDS', 300),
    otpResendSeconds: int('OTP_RESEND_SECONDS', 30),
    otpMaxAttempts: int('OTP_MAX_ATTEMPTS', 5),
    otpDevEcho: !isProduction && process.env.OTP_DEV_ECHO === 'true',
  };
}
