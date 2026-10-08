import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import {
  ComplaintCategory,
  ComplaintStatus,
  FEEDBACK_LIMITS,
  type ComplaintListQuery,
  type CreateComplaintRequest,
} from '@mess/shared';
import { PaginationQueryDto } from '../../../common/http/pagination';
import { Trim } from '../../../common/http/transforms';
import { IsDateOnly } from '../../../common/http/validators';

export class CreateComplaintDto implements CreateComplaintRequest {
  @IsIn(Object.values(ComplaintCategory), { message: 'Choose what the complaint is about' })
  category: ComplaintCategory;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Describe the problem' })
  @MaxLength(FEEDBACK_LIMITS.complaintMax)
  description: string;

  @IsOptional()
  @IsUUID('4', { message: 'Invalid photo' })
  attachmentId?: string;

  @IsOptional()
  @Matches(/^[A-Za-z0-9-]{8,64}$/)
  idempotencyKey?: string;
}

export class ComplaintStatusDto {
  @IsIn([ComplaintStatus.IN_PROGRESS, ComplaintStatus.RESOLVED], { message: 'Status can be IN_PROGRESS or RESOLVED' })
  status: ComplaintStatus;
}

export class ComplaintResponseDto {
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Write a reply' })
  @MaxLength(FEEDBACK_LIMITS.responseMax)
  message: string;
}

export class ListComplaintsQueryDto extends PaginationQueryDto implements ComplaintListQuery {
  @IsOptional() @IsIn(Object.values(ComplaintStatus)) status?: ComplaintStatus;
  @IsOptional() @IsIn(Object.values(ComplaintCategory)) category?: ComplaintCategory;
  @IsOptional() @IsDateOnly() from?: string;
  @IsOptional() @IsDateOnly() to?: string;
  @IsOptional() @Trim() @MaxLength(100) search?: string;
}

export class StudentComplaintsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsIn(Object.values(ComplaintStatus)) status?: ComplaintStatus;
}
