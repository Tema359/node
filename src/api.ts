import 'reflect-metadata';
import { createServer } from 'node:http';
import { Controller } from './decorators/controller.js';
import { Injectable } from './decorators/injectable.js';
import { Get, Post } from './decorators/methods.js';
import { Body, Param, Query } from './decorators/params.js';
import { Dispatcher } from './dispatcher.js';
import { CreateUserDto } from './dto/create-user.dto.js';

@Injectable()
class UsersService {
  findOne(id: string) {
    return { id };
  }

  findAll(limit: string | undefined) {
    return { limit };
  }

  create(dto: CreateUserDto) {
    return dto;
  }
}

@Controller('users')
class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  findAll(@Query('limit') limit: string | undefined) {
    return this.users.findAll(limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }
}

@Controller('health')
class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}

const port = Number(process.env.PORT ?? 3000);
const dispatcher = new Dispatcher([UsersController, HealthController]);

createServer(dispatcher.handle).listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
