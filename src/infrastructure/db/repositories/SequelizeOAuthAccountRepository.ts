import { Service } from 'typedi';
import { OAuthAccountModel } from '../models/OAuthAccountModel';
import { OAuthAccountRepository } from '../../../domain/oauth/OAuthAccountRepository';
import { OAuthAccount, OAuthProvider } from '../../../domain/oauth/OAuthAccount';
import { UniqueEntityId } from '../../../domain/shared/UniqueEntityId';

@Service()
export class SequelizeOAuthAccountRepository implements OAuthAccountRepository {
  async findByProviderAndProviderId(
    provider: OAuthProvider,
    providerId: string,
  ): Promise<OAuthAccount | null> {
    const model = await OAuthAccountModel.findOne({ where: { provider, providerId } });
    if (!model) return null;
    return OAuthAccount.reconstitute(
      {
        userId: model.userId,
        provider: model.provider,
        providerId: model.providerId,
        email: model.email,
        createdAt: model.createdAt,
      },
      new UniqueEntityId(model.id),
    );
  }

  async save(account: OAuthAccount): Promise<void> {
    await OAuthAccountModel.upsert({
      id: account.id.toValue(),
      userId: account.userId,
      provider: account.provider,
      providerId: account.providerId,
      email: account.email,
      createdAt: account.createdAt,
    } as any);
  }
}
