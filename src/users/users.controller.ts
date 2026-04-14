import { Controller, Get, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET /users/me — alias for /auth/me
  @Get('me')
  getMe(@CurrentUser() user: any) {
    return this.usersService.findById(user.sub);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: any, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(user.sub, updateUserDto);
  }

  @Delete('me')
  deleteMe(@CurrentUser() user: any) {
    return this.usersService.remove(user.sub);
  }

  // Admin: list all users
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
