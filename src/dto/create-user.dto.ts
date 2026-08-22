import { IsEmail, IsString, MinLength } from '../pipes/validation.pipe.js';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @IsEmail()
  email!: string;
}
