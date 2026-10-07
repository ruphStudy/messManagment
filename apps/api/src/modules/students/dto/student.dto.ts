import { PartialType, PickType } from '@nestjs/swagger';
import { applyDecorators } from '@nestjs/common';
import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import {
  EMAIL_REGEX,
  LIMITS,
  MESSAGES,
  MOBILE_REGEX,
  STUDENT_SELF_EDITABLE,
  STUDENT_SORT_FIELDS,
  StudentStatus,
  TOGGLEABLE_STUDENT_STATUSES,
  type SortOrder,
  type StudentInput,
  type StudentListQuery,
  type StudentSortField,
  type ToggleableStudentStatus,
} from '@mess/shared';
import { PaginationQueryDto } from '../../../common/http/pagination';
import { IsDateOnly, OptionalText } from '../../../common/http/validators';
import { EmptyToNull, NormalizeMobile, NormalizeOptionalMobile, Trim, TrimLower } from '../../../common/http/transforms';

const OptionalMobile = () =>
  applyDecorators(IsOptional(), NormalizeOptionalMobile(), Matches(MOBILE_REGEX, { message: MESSAGES.mobile }));

export class CreateStudentDto implements StudentInput {
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @MaxLength(LIMITS.nameMax)
  firstName: string;

  @OptionalText(LIMITS.nameMax)
  lastName: string | null;

  @NormalizeMobile()
  @Matches(MOBILE_REGEX, { message: MESSAGES.mobile })
  mobile: string;

  @IsOptional()
  @TrimLower()
  @EmptyToNull()
  @MaxLength(LIMITS.emailMax)
  @Matches(EMAIL_REGEX, { message: MESSAGES.email })
  email: string | null;

  @OptionalText(LIMITS.textMax)
  collegeName: string | null;

  @OptionalText(LIMITS.textMax)
  courseName: string | null;

  @OptionalText(LIMITS.textMax)
  hostelOrPg: string | null;

  @OptionalText(LIMITS.addressMax)
  localAddress: string | null;

  @OptionalText(LIMITS.nameMax)
  parentName: string | null;

  @OptionalMobile()
  parentMobile: string | null;

  @OptionalText(LIMITS.nameMax)
  emergencyContactName: string | null;

  @OptionalMobile()
  emergencyContactMobile: string | null;

  /** YYYY-MM-DD */
  @IsDateOnly()
  joiningDate: string;

  @OptionalText(LIMITS.notesMax)
  notes: string | null;
}

export class UpdateStudentDto extends PartialType(CreateStudentDto) {}

export class UpdateStudentSelfDto extends PartialType(PickType(CreateStudentDto, STUDENT_SELF_EDITABLE)) {}

export class UpdateStudentStatusDto {
  @IsIn(TOGGLEABLE_STUDENT_STATUSES, { message: 'Status must be ACTIVE or INACTIVE' })
  status: ToggleableStudentStatus;
}

export class ListStudentsQueryDto extends PaginationQueryDto implements StudentListQuery {
  @IsOptional()
  @Trim()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(Object.values(StudentStatus))
  status?: StudentStatus;

  @IsOptional()
  @IsIn(STUDENT_SORT_FIELDS)
  sortBy: StudentSortField = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: SortOrder = 'desc';
}
