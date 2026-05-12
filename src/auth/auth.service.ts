import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { BillingService } from '../billing/billing.service';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly refreshSecret: string;
  private readonly refreshExpiresIn: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly billingService: BillingService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    // In production, JWT_REFRESH_SECRET must equal a distinct value (ENV validation enforces this).
    // In development, fall back to secret+suffix to allow local starts without extra config.
    const refreshSecret = configService.get<string>('JWT_REFRESH_SECRET');
    this.refreshSecret =
      refreshSecret ||
      (configService.get<string>('JWT_SECRET') ?? '') + '-refresh-dev-only';
    this.refreshExpiresIn = configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
  }

  async register(registerDto: RegisterDto): Promise<TokenPair & { user: any }> {
    const existing = await this.usersService.findByEmail(registerDto.email);
    if (existing) throw new ConflictException('Email already in use');

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
    });

    await this.billingService.createSubscription(user.id);

    const tokens = this.generateTokenPair({ sub: user.id, email: user.email, role: user.role });
    return { ...tokens, user: this.sanitize(user) };
  }

  async login(loginDto: LoginDto): Promise<TokenPair & { user: any }> {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(loginDto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const tokens = this.generateTokenPair({ sub: user.id, email: user.email, role: user.role });
    return { ...tokens, user: this.sanitize(user) };
  }

  async getMe(userId: string) {
    return this.usersService.findById(userId);
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    if (dto.email) {
      const existing = await this.usersService.findByEmail(dto.email);
      if (existing && existing.id !== userId) {
        throw new ConflictException('Email already in use');
      }
    }
    return this.usersService.update(userId, dto);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usersService.findByIdWithPassword(userId);
    const valid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await this.usersService.updatePassword(userId, hashed);
    return { message: 'Password updated successfully' };
  }

  /**
   * Issues a fresh access token from a validated JWT payload.
   * Called by the refresh endpoint after JwtRefreshGuard validates the cookie.
   */
  refreshAccessToken(payload: { sub: string; email: string; role: string }): string {
    return this.jwtService.sign({ sub: payload.sub, email: payload.email, role: payload.role });
  }

  /**
   * Generates both an access token and a refresh token for the given payload.
   * Access token uses the primary JWT_SECRET; refresh token uses JWT_REFRESH_SECRET.
   */
  generateTokenPair(payload: { sub: string; email: string; role: string }): TokenPair {
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshExpiresIn,
    });
    return { accessToken, refreshToken };
  }

  private sanitize(user: any) {
    const { password: _p, ...rest } = user;
    return rest;
  }
}
