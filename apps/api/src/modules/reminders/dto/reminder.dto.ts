import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsUUID, ValidateIf } from 'class-validator';
import {
  NOTIFICATION_LIMITS,
  ReminderReason,
  type BulkPaymentReminderRequest,
  type SendReminderRequest,
} from '@mess/shared';
import { OptionalText } from '../../../common/http/validators';

export class SendReminderDto implements SendReminderRequest {
  @IsIn(Object.values(ReminderReason), { message: 'Choose a reminder type' })
  reason: ReminderReason;

  @OptionalText(NOTIFICATION_LIMITS.noteMax)
  note?: string;
}

export class BulkPaymentReminderDto implements BulkPaymentReminderRequest {
  @ValidateIf((o: BulkPaymentReminderDto) => !o.allWithDues)
  @IsArray()
  @ArrayMinSize(1, { message: 'Select at least one student' })
  @ArrayMaxSize(NOTIFICATION_LIMITS.bulkMax, { message: `Remind at most ${NOTIFICATION_LIMITS.bulkMax} students at once` })
  @IsUUID('4', { each: true })
  studentIds?: string[];

  @IsOptional()
  @IsBoolean()
  allWithDues?: boolean;
}
