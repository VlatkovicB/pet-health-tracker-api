import { Inject, Service } from 'typedi';
import jwt from 'jsonwebtoken';
import { UserRepository, USER_REPOSITORY } from '../../domain/user/UserRepository';
import { OAuthAccountRepository, OAUTH_ACCOUNT_REPOSITORY } from '../../domain/oauth/OAuthAccountRepository';
import { PetShareRepository, PET_SHARE_REPOSITORY } from '../../domain/share/PetShareRepository';
import { PetOwnershipTransferRepository, PET_OWNERSHIP_TRANSFER_REPOSITORY } from '../../domain/transfer/PetOwnershipTransferRepository';
import { OAuthAccount, OAuthProvider } from '../../domain/oauth/OAuthAccount';
import { User } from '../../domain/user/User';
import { NotFoundError } from '../../shared/errors/AppError';

export interface OAuthCallbackInput {
  provider: OAuthProvider;
  providerId: string;
  email: string | null;
  name: string | null;
}

@Service()
export class OAuthCallbackUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(OAUTH_ACCOUNT_REPOSITORY) private readonly oauthRepo: OAuthAccountRepository,
    @Inject(PET_SHARE_REPOSITORY) private readonly shareRepo: PetShareRepository,
    @Inject(PET_OWNERSHIP_TRANSFER_REPOSITORY) private readonly transferRepo: PetOwnershipTransferRepository,
  ) {}

  async execute(input: OAuthCallbackInput): Promise<{ token: string }> {
    const existingAccount = await this.oauthRepo.findByProviderAndProviderId(
      input.provider,
      input.providerId,
    );

    let user: User | null = null;

    if (existingAccount) {
      user = await this.userRepo.findById(existingAccount.userId);
      if (!user) throw new NotFoundError('User');
    } else {
      // Auto-link by email — skip for Apple private relay addresses
      const isAppleRelay = input.email?.endsWith('@privaterelay.appleid.com') ?? false;
      if (input.email && !isAppleRelay) {
        user = await this.userRepo.findByEmail(input.email);
      }

      if (!user) {
        user = User.create({
          name: input.name ?? input.email ?? 'User',
          email: input.email ?? `${input.provider}_${input.providerId}@oauth.local`,
          passwordHash: null,
        });
        await this.userRepo.save(user);
        if (input.email) {
          await this.shareRepo.linkInvitedUser(input.email, user.id.toValue());
          await this.transferRepo.linkInvitedUser(input.email, user.id.toValue());
        }
      }

      const newAccount = OAuthAccount.create({
        userId: user.id.toValue(),
        provider: input.provider,
        providerId: input.providerId,
        email: input.email,
      });
      await this.oauthRepo.save(newAccount);
    }

    if (!user) throw new Error(`User not found after OAuth callback for ${input.provider}:${input.providerId}`);

    const token = jwt.sign(
      { userId: user.id.toValue(), email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as any },
    );

    return { token };
  }
}
