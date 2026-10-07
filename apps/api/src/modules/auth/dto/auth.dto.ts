import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import {
  EMAIL_REGEX,
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
import { Trim, TrimLower } from '../../../common/http/transforms';

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

  @Trim()
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
  @Trim()
  @Matches(MOBILE_REGEX, { message: MESSAGES.mobile })
  mobile: string;
}

export class VerifyOtpDto implements VerifyOtpRequest {
  @Trim()
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
