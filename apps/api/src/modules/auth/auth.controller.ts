import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { API_PREFIX, AuthContext, AuthResponse, CLIENT_HEADER, ClientType } from '@mess/shared';
import { APP_CONFIG, AppConfig } from '../../config/app-config';
import { CurrentAuth, Public } from '../../common/decorators/auth.decorators';
import type { RequestAuth } from '../../common/auth.types';
import { toAuthContext } from '../users/user.mapper';
import { AuthResult, AuthService } from './auth.service';
import { LoginDto, RefreshDto, RegisterOwnerDto, RequestOtpDto, VerifyOtpDto } from './dto/auth.dto';

const REFRESH_COOKIE = 'mm_refresh';
const STRICT_LIMIT = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @Throttle(STRICT_LIMIT)
  @Post('register')
  register(@Body() dto: RegisterOwnerDto) {
    return this.auth.registerOwner(dto);
  }

  @Public()
  @Throttle(STRICT_LIMIT)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.deliver(await this.auth.login(dto, this.meta(req)), req, res);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestStudentOtp(dto.mobile);
  }

  @Public()
  @Throttle(STRICT_LIMIT)
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.deliver(await this.auth.verifyStudentOtp(dto.mobile, dto.code, this.meta(req)), req, res);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      return this.deliver(await this.auth.refresh(this.refreshToken(req, dto)), req, res);
    } catch (error) {
      if (!this.isMobile(req)) this.clearCookie(res);
      throw error;
    }
  }

  /** Public so a client with an expired access token can still end its session. */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(this.refreshToken(req, dto));
    this.clearCookie(res);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentAuth() auth: RequestAuth): AuthContext {
    return toAuthContext(auth);
  }

  private deliver({ response, session }: AuthResult, req: Request, res: Response): AuthResponse {
    if (this.isMobile(req)) {
      return session.refreshToken ? { ...response, refreshToken: session.refreshToken } : response;
    }
    if (session.refreshToken) {
      res.cookie(REFRESH_COOKIE, session.refreshToken, {
        ...this.cookieOptions(),
        ...(session.persistent ? { expires: session.expiresAt } : {}),
      });
    }
    return response;
  }

  private refreshToken(req: Request, dto: RefreshDto): string | undefined {
    return this.isMobile(req) ? dto.refreshToken : (req.cookies?.[REFRESH_COOKIE] as string | undefined);
  }

  private clearCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'lax' as const,
      path: `${API_PREFIX}/auth`,
    };
  }

  private isMobile(req: Request) {
    return req.header(CLIENT_HEADER)?.toUpperCase() === ClientType.MOBILE;
  }

  private meta(req: Request) {
    return {
      clientType: this.isMobile(req) ? ClientType.MOBILE : ClientType.WEB,
      userAgent: req.header('user-agent'),
      ipAddress: req.ip,
    };
  }
}
