import { Inject, Service } from 'typedi';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRepository, USER_REPOSITORY } from '../../domain/user/UserRepository';
import { UnauthorizedError } from '../../shared/errors/AppError';

interface LoginUserInput {
  email: string;
  password: string;
}

@Service()
export class LoginUserUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepository: UserRepository) {}

  async execute(input: LoginUserInput): Promise<{ token: string }> {
    const user = await this.userRepository.findByEmail(input.email);
    if (!user) throw new UnauthorizedError('Invalid credentials');

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) throw new UnauthorizedError('Invalid credentials');

    const token = jwt.sign(
      { userId: user.id.toValue(), email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as any },
    );

    return { token };
  }
}
