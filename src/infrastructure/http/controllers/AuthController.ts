import { JsonController, Post, Body, HttpCode, Res } from 'routing-controllers';
import { Response } from 'express';
import { Service } from 'typedi';
import { RegisterUserUseCase } from '../../../application/auth/RegisterUserUseCase';
import { LoginUserUseCase } from '../../../application/auth/LoginUserUseCase';
import { Validate } from '../decorators/Validate';
import { RegisterSchema, RegisterBody, LoginSchema, LoginBody } from '../schemas/authSchemas';

const isProduction = process.env.NODE_ENV === 'production';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: (isProduction ? 'none' : 'strict') as 'none' | 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

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
  async register(@Body() body: RegisterBody, @Res() res: Response) {
    await this.registerUser.execute(body);
    const result = await this.loginUser.execute({ email: body.email, password: body.password });
    res.cookie('token', result.token, COOKIE_OPTIONS);
    return res.json({ ok: true });
  }

  @Post('/login')
  @Validate({ body: LoginSchema })
  async login(@Body() body: LoginBody, @Res() res: Response) {
    const result = await this.loginUser.execute(body);
    res.cookie('token', result.token, COOKIE_OPTIONS);
    return res.json({ ok: true });
  }

  @Post('/logout')
  logout(@Res() res: Response) {
    res.clearCookie('token', { httpOnly: true, secure: COOKIE_OPTIONS.secure, sameSite: COOKIE_OPTIONS.sameSite });
    return res.json({ ok: true });
  }
}
