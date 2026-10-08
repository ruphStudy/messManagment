import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import {
  ChangePasswordRequest,
  EMAIL_REGEX,
  PasswordResetConfirm,
  PasswordResetRequest,
  UpdateAccountRequest,
  LIMITS,
  LoginRequest,
  MESSAGES,
  MOBILE_REGEX,
  OTP_LENGTH,
  PASSWORD_REGEX,
  RegisterOwnerRequest,
  RequestOtpRequest,
  VerifyOtpRequest,
} from '@mess/shared';
import { EmptyToNull, NormalizeMobile, Trim, TrimLower } from '../../../common/http/transforms';

export class RegisterOwnerDto implements RegisterOwnerRequest {
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @MaxLength(LIMITS.nameMax)
  firstName: string;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  @MaxLength(LIMITS.nameMax)
  lastName: string;

  @NormalizeMobile()
  @Matches(MOBILE_REGEX, { message: MESSAGES.mobile })
  mobile: string;

  @TrimLower()
  @MaxLength(LIMITS.emailMax)
  @Matches(EMAIL_REGEX, { message: MESSAGES.email })
  email: string;

  @IsString()
  @Matches(PASSWORD_REGEX, { message: MESSAGES.password })
  password: string;
}

export class LoginDto implements LoginRequest {
  /** Email address or 10-digit mobile number */
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Enter your mobile number or email' })
  @MaxLength(LIMITS.emailMax)
  identifier: string;

  @IsString()
  @IsNotEmpty({ message: 'Enter your password' })
  @MaxLength(LIMITS.passwordMax)
  password: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class RequestOtpDto implements RequestOtpRequest {
  @NormalizeMobile()
  @Matches(MOBILE_REGEX, { message: MESSAGES.mobile })
  mobile: string;
}

export class VerifyOtpDto implements VerifyOtpRequest {
  @NormalizeMobile()
  @Matches(MOBILE_REGEX, { message: MESSAGES.mobile })
  mobile: string;

  @Trim()
  @Matches(new RegExp(`^\\d{${OTP_LENGTH}}$`), { message: MESSAGES.otp })
  code: string;
}

/** Mobile clients send the refresh token in the body; web relies on the httpOnly cookie. */
export class RefreshDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  refreshToken?: string;
}

export class UpdateAccountDto implements UpdateAccountRequest {
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @MaxLength(LIMITS.nameMax)
  firstName?: string;

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

export class ChangePasswordDto implements ChangePasswordRequest {
  @IsString()
  @IsNotEmpty({ message: 'Enter your current password' })
  @MaxLength(LIMITS.passwordMax)
  currentPassword: string;

  @IsString()
  @Matches(PASSWORD_REGEX, { message: MESSAGES.password })
  newPassword: string;
}

export class PasswordResetRequestDto extends RequestOtpDto implements PasswordResetRequest {}

export class PasswordResetConfirmDto extends VerifyOtpDto implements PasswordResetConfirm {
  @IsString()
  @Matches(PASSWORD_REGEX, { message: MESSAGES.password })
  newPassword: string;
}
