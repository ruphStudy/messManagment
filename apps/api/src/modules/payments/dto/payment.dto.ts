import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import {
  PAYMENT_LIMITS,
  PaymentMethod,
  PaymentTransactionStatus,
  SubscriptionPaymentStatus,
  SubscriptionStatus,
  type DuesQuery,
  type MonthlyStatusQuery,
  type PaymentListQuery,
  type RecordPaymentRequest,
} from '@mess/shared';
import { PaginationQueryDto } from '../../../common/http/pagination';
import { Trim } from '../../../common/http/transforms';
import { IsDateOnly, OptionalText } from '../../../common/http/validators';

export class RecordPaymentDto implements RecordPaymentRequest {
  @IsUUID('4', { message: 'Select a student' })
  studentId: string;

  @IsUUID('4', { message: 'Select a subscription' })
  subscriptionId: string;

  /** Integer paise (₹1 = 100). */
  @IsInt({ message: 'Enter a valid amount' })
  @Min(1, { message: 'Amount must be more than ₹0' })
  @Max(100_000_000)
  amountPaise: number;

  @IsIn(Object.values(PaymentMethod), { message: 'Choose a payment method' })
  method: PaymentMethod;

  @IsOptional()
  @IsDateOnly()
  paymentDate?: string;

  @OptionalText(PAYMENT_LIMITS.referenceMax)
  referenceNumber?: string;

  @OptionalText(PAYMENT_LIMITS.noteMax)
  note?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9-]{8,64}$/)
  idempotencyKey?: string;
}

export class ReversePaymentDto {
  @OptionalText(PAYMENT_LIMITS.noteMax)
  reason?: string;
}

export class ListPaymentsQueryDto extends PaginationQueryDto implements PaymentListQuery {
  @IsOptional()
  @IsDateOnly()
  from?: string;

  @IsOptional()
  @IsDateOnly()
  to?: string;

  @IsOptional()
  @IsIn(Object.values(PaymentMethod))
  method?: PaymentMethod;

  @IsOptional()
  @IsIn(Object.values(PaymentTransactionStatus))
  status?: PaymentTransactionStatus;

  @IsOptional()
  @IsUUID('4')
  studentId?: string;

  @IsOptional()
  @IsUUID('4')
  subscriptionId?: string;

  @IsOptional()
  @Trim()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(['paymentDate', 'amount'])
  sortBy?: 'paymentDate' | 'amount';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

export class DuesQueryDto extends PaginationQueryDto implements DuesQuery {
  @IsOptional()
  @Trim()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn([SubscriptionStatus.ACTIVE, SubscriptionStatus.UPCOMING, SubscriptionStatus.EXPIRED])
  subscriptionStatus?: DuesQuery['subscriptionStatus'];

  @IsOptional()
  @IsUUID('4')
  studentId?: string;
}

export class MonthlyStatusQueryDto extends PaginationQueryDto implements MonthlyStatusQuery {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Use YYYY-MM' })
  month: string;

  @IsOptional()
  @IsIn(Object.values(SubscriptionPaymentStatus))
  paymentStatus?: SubscriptionPaymentStatus;

  @IsOptional()
  @Trim()
  @MaxLength(100)
  search?: string;
}
