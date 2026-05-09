import { Entity } from '../shared/Entity';
import { UniqueEntityId } from '../shared/UniqueEntityId';

export type OAuthProvider = 'google' | 'facebook' | 'apple';

interface OAuthAccountProps {
  userId: string;
  provider: OAuthProvider;
  providerId: string;
  email: string | null;
  createdAt: Date;
}

export class OAuthAccount extends Entity<OAuthAccountProps> {
  get userId(): string { return this.props.userId; }
  get provider(): OAuthProvider { return this.props.provider; }
  get providerId(): string { return this.props.providerId; }
  get email(): string | null { return this.props.email; }
  get createdAt(): Date { return this.props.createdAt; }

  static create(
    props: Omit<OAuthAccountProps, 'createdAt'>,
    id?: UniqueEntityId,
  ): OAuthAccount {
    return new OAuthAccount({ ...props, createdAt: new Date() }, id);
  }

  static reconstitute(props: OAuthAccountProps, id: UniqueEntityId): OAuthAccount {
    return new OAuthAccount(props, id);
  }
}
