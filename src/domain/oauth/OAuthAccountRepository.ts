import { OAuthAccount, OAuthProvider } from './OAuthAccount';

export interface OAuthAccountRepository {
  findByProviderAndProviderId(
    provider: OAuthProvider,
    providerId: string,
  ): Promise<OAuthAccount | null>;
  save(account: OAuthAccount): Promise<void>;
}

export const OAUTH_ACCOUNT_REPOSITORY = 'OAuthAccountRepository';
