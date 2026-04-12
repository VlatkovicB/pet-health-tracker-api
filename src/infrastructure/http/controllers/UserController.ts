import { Request, Response, NextFunction } from 'express';
import { Service } from 'typedi';
import { Inject } from 'typedi';
import { UserRepository, USER_REPOSITORY } from '../../../domain/user/UserRepository';
import { UserMapper } from '../../mappers/UserMapper';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';
import { ThemeMode } from '../../../domain/user/User';

@Service()
export class UserController {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    private readonly userMapper: UserMapper,
  ) {}

  getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.userRepo.findById(req.auth.userId);
      if (!user) return next(new NotFoundError('User'));
      res.json(this.userMapper.toResponse(user));
    } catch (err) {
      next(err);
    }
  };

  updateTheme = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { theme } = req.body as { theme: ThemeMode };
      if (theme !== 'light' && theme !== 'dark') {
        return next(new ValidationError('theme must be "light" or "dark"'));
      }
      await this.userRepo.updateTheme(req.auth.userId, theme);
      res.json({ theme });
    } catch (err) {
      next(err);
    }
  };
}
