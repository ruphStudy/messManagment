import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { PushStatus } from '@prisma/client';
import type { SystemStatus } from '@mess/shared';
import { APP_CONFIG, AppConfig } from '../../config/app-config';
import { PrismaService } from '../../prisma/prisma.service';

function apiVersion(): string {
  try {
    return (JSON.parse(readFileSync(join(__dirname, '../../../package.json'), 'utf8')) as { version?: string }).version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}
const VERSION = apiVersion();

/**
 * Informational status only. Reports modes and booleans — never URLs, paths, tokens, secrets or env values.
 */
@Injectable()
export class AdminSystemService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async status(): Promise<SystemStatus> {
    const database = await this.pingDatabase();
    const weekAgo = new Date(Date.now() - 7 * 86_400_000);
    const [total, failed, devices] = database.reachable
      ? await Promise.all([
          this.prisma.notification.count(),
          this.prisma.notification.count({ where: { pushStatus: PushStatus.FAILED, createdAt: { gte: weekAgo } } }),
          this.prisma.pushDevice.count({ where: { isActive: true } }),
        ])
      : [0, 0, 0];
    return {
      environment: this.config.nodeEnv,
      version: VERSION,
      uptimeSeconds: Math.round(process.uptime()),
      checkedAt: new Date().toISOString(),
      database,
      push: { provider: this.config.pushProvider, accessTokenConfigured: !!this.config.expoAccessToken },
      sms: { provider: this.config.smsProvider },
      scheduler: { enabled: this.config.schedulerEnabled },
      storage: {
        provider: 'local',
        warning: 'Complaint photos are stored on the API server’s local disk. Use a persistent, backed-up volume (object storage is a later step).',
      },
      notifications: { total, pushFailedLast7Days: failed, activeDevices: devices },
    };
  }

  private async pingDatabase() {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { reachable: true, latencyMs: Date.now() - started };
    } catch {
      return { reachable: false, latencyMs: null };
    }
  }
}
