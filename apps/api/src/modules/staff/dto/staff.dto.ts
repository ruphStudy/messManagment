import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import {
  EMAIL_REGEX,
  LIMITS,
  MESSAGES,
  MOBILE_REGEX,
  PASSWORD_REGEX,
  Role,
  STAFF_ASSIGNABLE_ROLES,
  type CreateStaffRequest,
  type ResetStaffPasswordRequest,
  type SetStaffStatusRequest,
  type StaffListQuery,
  type StaffRole,
  type StaffStatus,
  type UpdateStaffRequest,
} from '@mess/shared';
import { PaginationQueryDto } from '../../../common/http/pagination';
import { EmptyToNull, NormalizeMobile, Trim, TrimLower } from '../../../common/http/transforms';

const ROLE_MESSAGE = 'Choose Manager or Staff';

export class ListStaffQueryDto extends PaginationQueryDto implements StaffListQuery {
  @IsOptional() @Trim() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsIn([...STAFF_ASSIGNABLE_ROLES, Role.MESS_OWNER]) role?: StaffRole | 'MESS_OWNER';
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE']) status?: StaffStatus;
}

class StaffNameDto {
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @MaxLength(LIMITS.nameMax)
  firstName: string;

  @IsOptional()
  @Trim()
  @EmptyToNull()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(LIMITS.nameMax)
  lastName?: string | null;

  @IsOptional()
  @TrimLower()
  @EmptyToNull()
  @ValidateIf((_, v) => v !== null)
  @MaxLength(LIMITS.emailMax)
  @Matches(EMAIL_REGEX, { message: MESSAGES.email })
  email?: string | null;
}

export class CreateStaffDto extends StaffNameDto implements CreateStaffRequest {
  @NormalizeMobile()
  @Matches(MOBILE_REGEX, { message: MESSAGES.mobile })
  mobile: string;

  /** Anything else (owner, admin, student) is rejected here, before any permission logic. */
  @IsIn(STAFF_ASSIGNABLE_ROLES, { message: ROLE_MESSAGE })
  role: StaffRole;

  @IsOptional()
  @IsString()
  @Matches(PASSWORD_REGEX, { message: MESSAGES.password })
  temporaryPassword?: string;
}

export class UpdateStaffDto implements UpdateStaffRequest {
  @IsOptional() @Trim() @IsString() @IsNotEmpty({ message: 'First name is required' }) @MaxLength(LIMITS.nameMax) firstName?: string;

  @IsOptional()
  @Trim()
  @EmptyToNull()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(LIMITS.nameMax)
  lastName?: string | null;

  @IsOptional()
  @TrimLower()
  @EmptyToNull()
  @ValidateIf((_, v) => v !== null)
  @MaxLength(LIMITS.emailMax)
  @Matches(EMAIL_REGEX, { message: MESSAGES.email })
  email?: string | null;

  @IsOptional()
  @IsIn(STAFF_ASSIGNABLE_ROLES, { message: ROLE_MESSAGE })
  role?: StaffRole;
}

export class SetStaffStatusDto implements SetStaffStatusRequest {
  @IsIn(['ACTIVE', 'INACTIVE'])
  status: StaffStatus;
}

export class ResetStaffPasswordDto implements ResetStaffPasswordRequest {
  @IsString()
  @Matches(PASSWORD_REGEX, { message: MESSAGES.password })
  temporaryPassword: string;
}
