import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  REFRESH_TOKEN_COOKIE,
  getRefreshCookieOptions,
  getClearCookieOptions,
} from '../common/config/security.config';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Rate-limited: 10 requests per 60 s per IP (overrides the global 100/min default)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('register')
  @ApiOperation({ summary: 'Register a new user and receive a JWT access token' })
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refreshToken, ...body } = await this.authService.register(registerDto);
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, getRefreshCookieOptions(this.isProd));
    return body; // { accessToken, user } — refreshToken never exposed in body
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive a JWT access token' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refreshToken, ...body } = await this.authService.login(loginDto);
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, getRefreshCookieOptions(this.isProd));
    return body; // { accessToken, user }
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token — issues new access + refresh token pair' })
  refresh(
    @CurrentUser() user: { sub: string; email: string; role: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    // Full token rotation: both tokens are reissued on every refresh
    const { accessToken, refreshToken } = this.authService.generateTokenPair(user);
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, getRefreshCookieOptions(this.isProd));
    return { accessToken };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Logout — clears the refresh token cookie' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.cookie(REFRESH_TOKEN_COOKIE, '', getClearCookieOptions(this.isProd));
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get current authenticated user' })
  getMe(@CurrentUser() user: any) {
    return this.authService.getMe(user.sub);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update own profile (name / email)' })
  updateMe(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    return this.authService.updateMe(user.sub, dto);
  }

  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change own password' })
  changePassword(@CurrentUser() user: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.sub, dto);
  }

  private get isProd(): boolean {
    return process.env.NODE_ENV === 'production';
  }
}
