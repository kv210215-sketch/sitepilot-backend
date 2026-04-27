import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from './entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

interface AuthenticatedUser {
  sub: string;
  email: string;
  role: UserRole;
}

@ApiTags('Users')
@ApiBearerAuth('JWT')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get own profile' })
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findById(user.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own profile' })
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(user.sub, updateUserDto);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Delete own account' })
  deleteMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.remove(user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List all users (admin)' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    this.assertAdmin(user);
    return this.usersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID (admin)' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    this.assertAdmin(user);
    return this.usersService.findById(id);
  }

  private assertAdmin(user: AuthenticatedUser) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin privileges required');
    }
  }
}
