import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { Permission } from '@mess/shared';
import {
  CurrentAuth,
  CurrentMessId,
  RequireMess,
  RequirePermissions,
  StudentOnly,
} from '../../common/decorators/auth.decorators';
import type { RequestAuth } from '../../common/auth.types';
import { PaginationQueryDto } from '../../common/http/pagination';
import { UuidParam } from '../../common/http/params';
import { DuesQueryDto, ListPaymentsQueryDto, MonthlyStatusQueryDto, RecordPaymentDto, ReversePaymentDto } from './dto/payment.dto';
import { PaymentsService } from './payments.service';

class MonthQueryDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Use YYYY-MM' })
  month: string;
}

const PaymentId = () => UuidParam('id', 'Payment');

@ApiTags('payments')
@Controller('payments')
@RequireMess()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @RequirePermissions(Permission.PAYMENT_VIEW)
  list(@CurrentMessId() messId: string, @Query() query: ListPaymentsQueryDto) {
    return this.payments.list(messId, query);
  }

  @Post()
  @RequirePermissions(Permission.PAYMENT_RECORD)
  record(@CurrentAuth() auth: RequestAuth, @CurrentMessId() messId: string, @Body() dto: RecordPaymentDto) {
    return this.payments.record(messId, auth.user.id, dto);
  }

  @Get('dues')
  @RequirePermissions(Permission.PAYMENT_VIEW)
  dues(@CurrentMessId() messId: string, @Query() query: DuesQueryDto) {
    return this.payments.dues(messId, query);
  }

  @Get('monthly/summary')
  @RequirePermissions(Permission.PAYMENT_VIEW)
  monthlySummary(@CurrentMessId() messId: string, @Query() query: MonthQueryDto) {
    return this.payments.monthlySummary(messId, query.month);
  }

  @Get('monthly')
  @RequirePermissions(Permission.PAYMENT_VIEW)
  monthly(@CurrentMessId() messId: string, @Query() query: MonthlyStatusQueryDto) {
    return this.payments.monthlyList(messId, query);
  }

  @Get('summary')
  @RequirePermissions(Permission.PAYMENT_VIEW)
  summary(@CurrentMessId() messId: string) {
    return this.payments.dashboard(messId);
  }

  @Get(':id')
  @RequirePermissions(Permission.PAYMENT_VIEW)
  get(@CurrentMessId() messId: string, @PaymentId() id: string) {
    return this.payments.getRecord(messId, id);
  }

  @Get(':id/receipt')
  @RequirePermissions(Permission.PAYMENT_VIEW)
  receipt(@CurrentMessId() messId: string, @PaymentId() id: string) {
    return this.payments.receipt(messId, id);
  }

  @Post(':id/reverse')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.PAYMENT_REVERSE)
  reverse(@CurrentAuth() auth: RequestAuth, @CurrentMessId() messId: string, @PaymentId() id: string, @Body() dto: ReversePaymentDto) {
    return this.payments.reverse(messId, auth.user.id, id, dto.reason);
  }
}

@ApiTags('payments')
@Controller('students')
export class StudentPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('me/fees')
  @StudentOnly()
  @RequirePermissions(Permission.STUDENT_SELF)
  fees(@CurrentAuth() auth: RequestAuth) {
    return this.payments.feesForSelf(auth.user);
  }

  @Get('me/payments')
  @StudentOnly()
  @RequirePermissions(Permission.STUDENT_SELF)
  mine(@CurrentAuth() auth: RequestAuth, @Query() query: PaginationQueryDto) {
    return this.payments.listForSelf(auth.user, query);
  }

  @Get('me/payments/:id')
  @StudentOnly()
  @RequirePermissions(Permission.STUDENT_SELF)
  receipt(@CurrentAuth() auth: RequestAuth, @PaymentId() id: string) {
    return this.payments.receiptForSelf(auth.user, id);
  }
}
