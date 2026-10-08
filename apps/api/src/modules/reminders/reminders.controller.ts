import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Permission } from '@mess/shared';
import { CurrentAuth, CurrentMessId, RequireMess, RequirePermissions } from '../../common/decorators/auth.decorators';
import type { RequestAuth } from '../../common/auth.types';
import { UuidParam } from '../../common/http/params';
import { BulkPaymentReminderDto, SendReminderDto } from './dto/reminder.dto';
import { RemindersService } from './reminders.service';

@ApiTags('reminders')
@Controller()
@RequireMess()
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  /** One student: payment (amount filled in automatically), renewal, contact-mess or general. */
  @Post('students/:studentId/reminders')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.REMINDER_SEND)
  send(@CurrentAuth() auth: RequestAuth, @CurrentMessId() messId: string, @UuidParam('studentId', 'Student') studentId: string, @Body() dto: SendReminderDto) {
    return this.reminders.sendToStudent(messId, auth.user.id, studentId, dto);
  }

  @Post('reminders/payment-due/bulk')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @RequirePermissions(Permission.REMINDER_SEND)
  bulk(@CurrentAuth() auth: RequestAuth, @CurrentMessId() messId: string, @Body() dto: BulkPaymentReminderDto) {
    return this.reminders.bulkPayment(messId, auth.user.id, dto);
  }

  /** Runs today's expiry reminders for this mess now (the daily job does all messes). Safe to repeat. */
  @Post('reminders/expiry/run')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.REMINDER_SEND)
  runExpiry(@CurrentMessId() messId: string) {
    return this.reminders.runExpiry(undefined, messId);
  }
}
