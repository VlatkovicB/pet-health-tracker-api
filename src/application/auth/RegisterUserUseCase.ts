import { Inject, Service } from 'typedi';
import bcrypt from 'bcryptjs';
import { UserRepository, USER_REPOSITORY } from '../../domain/user/UserRepository';
import { PetShareRepository, PET_SHARE_REPOSITORY } from '../../domain/share/PetShareRepository';
import { PetOwnershipTransferRepository, PET_OWNERSHIP_TRANSFER_REPOSITORY } from '../../domain/transfer/PetOwnershipTransferRepository';
import { User } from '../../domain/user/User';
import { AppError } from '../../shared/errors/AppError';

interface RegisterUserInput {
  name: string;
  email: string;
  password: string;
}

@Service()
export class RegisterUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(PET_SHARE_REPOSITORY) private readonly shareRepo: PetShareRepository,
    @Inject(PET_OWNERSHIP_TRANSFER_REPOSITORY) private readonly transferRepo: PetOwnershipTransferRepository,
  ) {}

  async execute(input: RegisterUserInput): Promise<{ id: string }> {
    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) throw new AppError('Email already in use', 409);

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = User.create({ name: input.name, email: input.email, passwordHash });

    await this.userRepository.save(user);

    const userId = user.id.toValue();
    await this.shareRepo.linkInvitedUser(input.email, userId);
    await this.transferRepo.linkInvitedUser(input.email, userId);

    return { id: userId };
  }
}
