import { JsonController, Get, Patch, Body, UseBefore, CurrentUser } from 'routing-controllers';
import { Service, Inject } from 'typedi';
import { UserRepository, USER_REPOSITORY } from '../../../domain/user/UserRepository';
import { UserMapper } from '../../mappers/UserMapper';
import { NotFoundError } from '../../../shared/errors/AppError';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';
import { Validate } from '../decorators/Validate';
import { UpdateThemeSchema, UpdateThemeBody } from '../schemas/userSchemas';

@JsonController('/users')
@Service()
@UseBefore(authMiddleware)
export class UserController {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    private readonly userMapper: UserMapper,
  ) {}

  @Get('/me')
  async getMe(@CurrentUser() user: AuthPayload) {
    const found = await this.userRepo.findById(user.userId);
    if (!found) throw new NotFoundError('User');
    return this.userMapper.toResponse(found);
  }

  @Patch('/me')
  @Validate({ body: UpdateThemeSchema })
  async updateTheme(@Body() body: UpdateThemeBody, @CurrentUser() user: AuthPayload) {
    await this.userRepo.updateTheme(user.userId, body.theme);
    return { theme: body.theme };
  }
}
