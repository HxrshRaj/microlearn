import { IsString } from 'class-validator';

const SIGNUP_MSG = 'username, email, and password are required.';
const LOGIN_MSG = 'email and password are required.';

export class SignupDto {
  @IsString({ message: SIGNUP_MSG }) username: string;
  @IsString({ message: SIGNUP_MSG }) email: string;
  @IsString({ message: SIGNUP_MSG }) password: string;
}

export class LoginDto {
  @IsString({ message: LOGIN_MSG }) email: string;
  @IsString({ message: LOGIN_MSG }) password: string;
}
