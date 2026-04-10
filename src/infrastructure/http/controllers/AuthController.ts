import { Request, Response, NextFunction } from 'express';
import { Service } from 'typedi';
import { RegisterUserUseCase } from '../../../application/auth/RegisterUserUseCase';
import { LoginUserUseCase } from '../../../application/auth/LoginUserUseCase';

@Service()
export class AuthController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly loginUser: LoginUserUseCase,
  ) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.registerUser.execute(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.loginUser.execute(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };
}
