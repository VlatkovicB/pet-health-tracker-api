import { Inject, Service } from 'typedi';
import bcrypt from 'bcryptjs';
import { UserRepository, USER_REPOSITORY } from '../../domain/user/UserRepository';
import { User } from '../../domain/user/User';
import { AppError } from '../../shared/errors/AppError';

interface RegisterUserInput {
  name: string;
  email: string;
  password: string;
}

@Service()
export class RegisterUserUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepository: UserRepository) {}

  async execute(input: RegisterUserInput): Promise<{ id: string }> {
    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) throw new AppError('Email already in use', 409);

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = User.create({ name: input.name, email: input.email, passwordHash });

    await this.userRepository.save(user);
    return { id: user.id.toValue() };
  }
}
