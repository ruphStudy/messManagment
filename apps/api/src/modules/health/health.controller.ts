import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ErrorCode } from '@mess/shared';
import { Public } from '../../common/decorators/auth.decorators';
import { AppException } from '../../common/http/app.exception';
import { APP_VERSION } from '../../config/app-version';
import { PrismaService } from '../../prisma/prisma.service';

/** Public liveness/readiness for load balancers: status, database reachability and version only. */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @SkipThrottle()
  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new AppException(HttpStatus.SERVICE_UNAVAILABLE, ErrorCode.INTERNAL_ERROR, 'Database unavailable');
    }
    return { status: 'ok', database: 'up', version: APP_VERSION };
  }
}
