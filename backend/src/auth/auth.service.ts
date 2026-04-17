import { Injectable, UnauthorizedException } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';

export interface LoginResult {
  message: string;
  email: string;
}

@Injectable()
export class AuthService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  login(_dto: LoginDto): LoginResult {
    // Stub: no DB yet. Always returns 401 until real user lookup is wired.
    // Replace this block with user lookup + bcrypt compare when UsersModule is ready.
    throw new UnauthorizedException('Invalid credentials');
  }
}
