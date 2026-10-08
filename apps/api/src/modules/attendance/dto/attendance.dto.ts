import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import {
  ATTENDANCE_NOTE_MAX,
  AttendanceStatus,
  MEAL_KEYS,
  type AttendanceListQuery,
  type ManualAttendanceRequest,
  type MealType,
  type ReverseAttendanceRequest,
  type ScanRequest,
} from '@mess/shared';
import { PaginationQueryDto } from '../../../common/http/pagination';
import { Trim } from '../../../common/http/transforms';
import { IsDateOnly, OptionalText } from '../../../common/http/validators';

const IsMealType = () => IsIn(MEAL_KEYS, { message: 'Choose breakfast, lunch or dinner' });

export class ScanDto implements ScanRequest {
  @IsString()
  @MaxLength(1000)
  qrToken: string;

  @IsMealType()
  mealType: MealType;
}

export class ManualAttendanceDto implements ManualAttendanceRequest {
  @IsUUID('4', { message: 'Select a student' })
  studentId: string;

  @IsMealType()
  mealType: MealType;

  @OptionalText(ATTENDANCE_NOTE_MAX)
  note?: string;
}

export class ReverseAttendanceDto implements ReverseAttendanceRequest {
  @OptionalText(ATTENDANCE_NOTE_MAX)
  reason?: string;
}

export class ListAttendanceQueryDto extends PaginationQueryDto implements AttendanceListQuery {
  @IsOptional()
  @IsDateOnly()
  date?: string;

  @IsOptional()
  @IsMealType()
  mealType?: MealType;

  @IsOptional()
  @IsIn(Object.values(AttendanceStatus))
  status?: AttendanceStatus;

  @IsOptional()
  @Trim()
  @MaxLength(100)
  search?: string;
}

export class AttendanceDateQueryDto {
  @IsOptional()
  @IsDateOnly()
  date?: string;
}
