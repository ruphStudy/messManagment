import { Injectable } from '@nestjs/common';
import type { PushPlatform } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Push tokens identify a device, not a person: re-registering moves the token to the signed-in user. */
@Injectable()
export class PushDevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async register(userId: string, token: string, platform: PushPlatform, deviceLabel?: string) {
    await this.prisma.pushDevice.upsert({
      where: { pushToken: token },
      create: { userId, pushToken: token, platform, deviceLabel: deviceLabel ?? null },
      update: { userId, platform, deviceLabel: deviceLabel ?? null, isActive: true, lastSeenAt: new Date() },
    });
    return { registered: true };
  }

  /** Only the token's current owner can deactivate it; unknown tokens are ignored (idempotent). */
  async unregister(userId: string, token: string) {
    await this.prisma.pushDevice.updateMany({ where: { pushToken: token, userId }, data: { isActive: false } });
    return { registered: false };
  }
}
