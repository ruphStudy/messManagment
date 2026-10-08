import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import {
  EXPENSE_LIMITS,
  ExpenseStatus,
  PaymentMethod,
  type ExpenseInput,
  type ExpenseListQuery,
} from '@mess/shared';
import { PaginationQueryDto } from '../../../common/http/pagination';
import { Trim } from '../../../common/http/transforms';
import { IsDateOnly, OptionalText } from '../../../common/http/validators';

export class CreateExpenseDto implements ExpenseInput {
  @IsUUID('4', { message: 'Choose a category' })
  categoryId: string;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'What was it for?' })
  @MaxLength(EXPENSE_LIMITS.titleMax)
  title: string;

  /** Integer paise (₹1 = 100). */
  @IsInt({ message: 'Enter a valid amount' })
  @Min(1, { message: 'Amount must be more than ₹0' })
  @Max(EXPENSE_LIMITS.amountMaxPaise, { message: 'Amount is too large for one entry' })
  amountPaise: number;

  @IsDateOnly()
  expenseDate: string;

  @IsOptional()
  @IsIn([...Object.values(PaymentMethod), null])
  paymentMethod?: PaymentMethod | null;

  @OptionalText(EXPENSE_LIMITS.vendorMax)
  vendorName?: string | null;

  @OptionalText(EXPENSE_LIMITS.referenceMax)
  referenceNumber?: string | null;

  @OptionalText(EXPENSE_LIMITS.noteMax)
  note?: string | null;
}

export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}

export class ReverseExpenseDto {
  @OptionalText(EXPENSE_LIMITS.noteMax)
  reason?: string;
}

export class ListExpensesQueryDto extends PaginationQueryDto implements ExpenseListQuery {
  @IsOptional()
  @IsDateOnly()
  from?: string;

  @IsOptional()
  @IsDateOnly()
  to?: string;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @IsIn(Object.values(ExpenseStatus))
  status?: ExpenseStatus;

  @IsOptional()
  @IsIn(Object.values(PaymentMethod))
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @Trim()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(['expenseDate', 'amount'])
  sortBy?: 'expenseDate' | 'amount';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

export class ExpenseRangeQueryDto {
  @IsDateOnly()
  from: string;

  @IsDateOnly()
  to: string;
}

export class MonthQueryDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Use YYYY-MM' })
  month: string;
}

export class CreateCategoryDto {
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Enter a category name' })
  @MaxLength(EXPENSE_LIMITS.categoryNameMax)
  name: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Enter a category name' })
  @MaxLength(EXPENSE_LIMITS.categoryNameMax)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CategoryListQueryDto {
  @IsOptional()
  @IsIn(['true', 'false'])
  includeInactive?: 'true' | 'false';
}
