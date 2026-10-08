import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import {
  ADMIN_MESS_SORT_FIELDS,
  ADMIN_REASON_MAX,
  AuditAction,
  AuditTargetType,
  ComplaintCategory,
  ComplaintStatus,
  MessStatus,
  MessType,
  Role,
  UserStatus,
  type AdminMessListQuery,
  type AdminMessSortField,
  type AdminUserListQuery,
  type AuditListQuery,
} from '@mess/shared';
import { PaginationQueryDto } from '../../../common/http/pagination';
import { Trim } from '../../../common/http/transforms';
import { IsDateOnly } from '../../../common/http/validators';

class DateRangeDto extends PaginationQueryDto {
  @IsOptional() @IsDateOnly() from?: string;
  @IsOptional() @IsDateOnly() to?: string;
}

export class AdminMessListQueryDto extends DateRangeDto implements AdminMessListQuery {
  @IsOptional() @Trim() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsIn(Object.values(MessStatus)) status?: MessStatus;
  @IsOptional() @Trim() @IsString() @MaxLength(60) city?: string;
  @IsOptional() @IsIn(Object.values(MessType)) messType?: MessType;
  @IsOptional() @IsIn(ADMIN_MESS_SORT_FIELDS) sortBy?: AdminMessSortField;
  @IsOptional() @IsIn(['asc', 'desc']) sortOrder?: 'asc' | 'desc';
}

export class AdminUserListQueryDto extends DateRangeDto implements AdminUserListQuery {
  @IsOptional() @Trim() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsIn(Object.values(Role)) role?: Role;
  @IsOptional() @IsIn(Object.values(UserStatus)) status?: UserStatus;
  @IsOptional() @IsUUID() messId?: string;
}

export class AdminComplaintsQueryDto extends DateRangeDto {
  @IsOptional() @IsUUID() messId?: string;
  @IsOptional() @IsIn(Object.values(ComplaintStatus)) status?: ComplaintStatus;
  @IsOptional() @IsIn(Object.values(ComplaintCategory)) category?: ComplaintCategory;
  @IsOptional() @Trim() @IsString() @MaxLength(100) search?: string;
}

export class AuditListQueryDto extends DateRangeDto implements AuditListQuery {
  @IsOptional() @IsUUID() actorUserId?: string;
  @IsOptional() @IsIn(Object.values(AuditAction)) action?: AuditAction;
  @IsOptional() @IsIn(Object.values(AuditTargetType)) targetType?: AuditTargetType;
  @IsOptional() @IsUUID() targetId?: string;
  @IsOptional() @IsUUID() messId?: string;
}

/** Read-only record views of one mess; mapped onto the module's own list DTO. */
export class AdminRecordsQueryDto extends DateRangeDto {
  @IsOptional() @Trim() @IsString() @MaxLength(100) search?: string;
}

export class SuspendDto {
  @Trim() @IsString() @IsNotEmpty({ message: 'Please give a reason' }) @MaxLength(ADMIN_REASON_MAX) reason: string;
}

export class ReactivateDto {
  @IsOptional() @Trim() @IsString() @MaxLength(ADMIN_REASON_MAX) reason?: string;
}
