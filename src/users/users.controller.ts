import { Controller, Get, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth('JWT')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get own profile' })
  getMe(@CurrentUser() user: any) {
    return this.usersService.findById(user.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own profile' })
  updateMe(@CurrentUser() user: any, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(user.sub, updateUserDto);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Delete own account' })
  deleteMe(@CurrentUser() user: any) {
    return this.usersService.remove(user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List all users (admin)' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID (admin)' })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
