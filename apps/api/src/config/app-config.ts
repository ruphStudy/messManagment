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
  /** expo = real push via Expo; log = write to server log (dev); disabled = in-app only. */
  pushProvider: 'expo' | 'log' | 'disabled';
  expoPushUrl: string;
  expoAccessToken: string | null;
  /** Run the daily expiry-reminder job in this process. */
  schedulerEnabled: boolean;
  /** Directory for uploaded files (local storage provider). */
  uploadDir: string;
  /** Optional support contact shown on the owner Billing screen (SUPPORT_EMAIL / SUPPORT_PHONE). */
  support: { email: string | null; phone: string | null };
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

  if (isProduction) assertProductionConfig();
  const smsProvider = process.env.SMS_PROVIDER ?? 'console';
  if (smsProvider !== 'console') throw new Error(`Unsupported SMS_PROVIDER "${smsProvider}"`);

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
    pushProvider: pushProvider(isProduction),
    expoPushUrl: process.env.EXPO_PUSH_URL ?? 'https://exp.host/--/api/v2/push/send',
    expoAccessToken: process.env.EXPO_ACCESS_TOKEN || null,
    schedulerEnabled: process.env.SCHEDULER_ENABLED !== 'false',
    uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
    support: { email: process.env.SUPPORT_EMAIL || null, phone: process.env.SUPPORT_PHONE || null },
  };
}

/**
 * Production must be configured deliberately: no localhost/dev providers, no example secrets, an explicit
 * persistent upload volume and an explicit scheduler choice. Fails fast with every problem listed at once.
 */
function assertProductionConfig() {
  const env = process.env;
  const problems: string[] = [];
  // Only the console (log) SMS provider exists today, so student OTP login cannot work in production yet.
  if ((env.SMS_PROVIDER ?? 'console') === 'console') problems.push('SMS_PROVIDER=console is for development only; configure a real SMS provider');
  const secret = env.JWT_ACCESS_SECRET ?? '';
  if (/change-me|example|secret/i.test(secret)) problems.push('JWT_ACCESS_SECRET looks like a placeholder; generate a random one');

  const origins = (env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  if (!origins.length) problems.push('CORS_ORIGINS must list the production web origin(s)');
  for (const o of origins) {
    if (!o.startsWith('https://') || /localhost|127\.0\.0\.1/.test(o)) problems.push(`CORS_ORIGINS entry "${o}" must be an https production origin`);
  }

  if (/localhost|127\.0\.0\.1/.test(env.DATABASE_URL ?? '') && env.ALLOW_LOCAL_DATABASE !== 'true') {
    problems.push('DATABASE_URL points to localhost (set ALLOW_LOCAL_DATABASE=true only if that is intentional)');
  }
  if (!env.PUSH_PROVIDER) problems.push('PUSH_PROVIDER must be set explicitly (expo or disabled)');
  else if (env.PUSH_PROVIDER === 'log') problems.push('PUSH_PROVIDER=log is for development only');
  if (env.OTP_DEV_ECHO === 'true') problems.push('OTP_DEV_ECHO must not be enabled in production');
  if (env.SCHEDULER_ENABLED !== 'true' && env.SCHEDULER_ENABLED !== 'false') {
    problems.push('SCHEDULER_ENABLED must be set to true (exactly one API instance) or false');
  }
  // Complaint photos live on local disk: refuse an implicit/relative (ephemeral) directory.
  if (!env.UPLOAD_DIR?.startsWith('/')) problems.push('UPLOAD_DIR must be an absolute path on a persistent volume');
  if (env.UPLOAD_STORAGE_PERSISTENT !== 'true') problems.push('Set UPLOAD_STORAGE_PERSISTENT=true to confirm UPLOAD_DIR is a persistent, backed-up volume');

  if (problems.length) throw new Error(`Unsafe production configuration:\n - ${problems.join('\n - ')}`);
}

function pushProvider(isProduction: boolean): AppConfig['pushProvider'] {
  const value = process.env.PUSH_PROVIDER ?? (isProduction ? 'expo' : 'log');
  if (value !== 'expo' && value !== 'log' && value !== 'disabled') throw new Error(`Unsupported PUSH_PROVIDER "${value}"`);
  return value;
}
