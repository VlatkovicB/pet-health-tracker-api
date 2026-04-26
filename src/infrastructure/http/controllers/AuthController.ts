import { JsonController, Post, Body, HttpCode } from 'routing-controllers';
import { Service } from 'typedi';
import { RegisterUserUseCase } from '../../../application/auth/RegisterUserUseCase';
import { LoginUserUseCase } from '../../../application/auth/LoginUserUseCase';
import { Validate } from '../decorators/Validate';
import { RegisterSchema, RegisterBody, LoginSchema, LoginBody } from '../schemas/authSchemas';

@JsonController('/auth')
@Service()
export class AuthController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly loginUser: LoginUserUseCase,
  ) {}

  @Post('/register')
  @HttpCode(201)
  @Validate({ body: RegisterSchema })
  async register(@Body() body: RegisterBody) {
    return this.registerUser.execute(body);
  }

  @Post('/login')
  @Validate({ body: LoginSchema })
  async login(@Body() body: LoginBody) {
    return this.loginUser.execute(body);
  }
}
