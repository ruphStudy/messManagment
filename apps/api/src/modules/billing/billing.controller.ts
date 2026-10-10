import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { BillingCycle, Permission } from '@mess/shared';
import { AdminOnly, CurrentAuth, CurrentMessId, RequireMess, RequirePermissions } from '../../common/decorators/auth.decorators';
import type { RequestAuth } from '../../common/auth.types';
import { UuidParam } from '../../common/http/params';
import { Trim } from '../../common/http/transforms';
import { IsDateOnly } from '../../common/http/validators';
import { BillingService } from './billing.service';

class NotesDto {
  @IsOptional() @Trim() @IsString() @MaxLength(300) notes?: string;
}
class ActivateDto extends NotesDto {
  @Trim() @IsString() @IsNotEmpty() @MaxLength(80) planName: string;
  @IsIn(Object.values(BillingCycle)) billingCycle: BillingCycle;
  @Type(() => Number) @IsInt() @Min(0) @Max(100_000_000) amountPaise: number;
  @IsOptional() @IsDateOnly() startDate?: string;
  @IsOptional() @IsDateOnly() endDate?: string;
  @IsOptional() @Trim() @IsString() @MaxLength(120) paymentReference?: string;
}
class StatusDto extends NotesDto {
  @IsIn(['EXPIRED', 'SUSPENDED']) status: 'EXPIRED' | 'SUSPENDED';
}

/** Owner/manager/staff: read-only MessMate subscription status (always allowed, even when inactive). */
@ApiTags('billing')
@RequireMess()
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @RequirePermissions(Permission.MESS_VIEW)
  summary(@CurrentMessId() messId: string) {
    return this.billing.summary(messId);
  }
}

/** Platform admin: trial / manual payment activation / status, with history. */
@ApiTags('admin')
@AdminOnly()
@Controller('admin/messes/:id/billing')
export class AdminBillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  detail(@UuidParam('id', 'Mess') id: string) {
    return this.billing.adminDetail(id);
  }

  @Post('trial')
  @HttpCode(HttpStatus.OK)
  trial(@CurrentAuth() auth: RequestAuth, @UuidParam('id', 'Mess') id: string, @Body() dto: NotesDto) {
    return this.billing.grantTrial(auth.user.id, id, dto.notes);
  }

  @Post('activate')
  @HttpCode(HttpStatus.OK)
  activate(@CurrentAuth() auth: RequestAuth, @UuidParam('id', 'Mess') id: string, @Body() dto: ActivateDto) {
    return this.billing.activate(auth.user.id, id, dto);
  }

  @Post('status')
  @HttpCode(HttpStatus.OK)
  status(@CurrentAuth() auth: RequestAuth, @UuidParam('id', 'Mess') id: string, @Body() dto: StatusDto) {
    return this.billing.setStatus(auth.user.id, id, dto.status, dto.notes);
  }
}
