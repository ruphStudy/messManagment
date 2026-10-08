import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@mess/shared';
import { CurrentAuth, CurrentMessId, RequireMess, RequirePermissions } from '../../common/decorators/auth.decorators';
import type { RequestAuth } from '../../common/auth.types';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@Controller('dashboard')
@RequireMess()
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /** Role-filtered: staff receive only meals and menu; finance needs FINANCE_VIEW. */
  @Get()
  @RequirePermissions(Permission.MESS_VIEW)
  overview(@CurrentAuth() auth: RequestAuth, @CurrentMessId() messId: string) {
    return this.dashboard.overview(messId, auth.role);
  }
}
