import { AggregateRoot } from '../shared/AggregateRoot';
import { UniqueEntityId } from '../shared/UniqueEntityId';

export type ThemeMode = 'light' | 'dark';

interface UserProps {
  name: string;
  email: string;
  passwordHash: string;
  theme: ThemeMode;
  createdAt: Date;
}

export class User extends AggregateRoot<UserProps> {
  get name(): string {
    return this.props.name;
  }

  get email(): string {
    return this.props.email;
  }

  get passwordHash(): string {
    return this.props.passwordHash;
  }

  get theme(): ThemeMode {
    return this.props.theme;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  setTheme(mode: ThemeMode): void {
    this.props.theme = mode;
  }

  static create(props: Omit<UserProps, 'createdAt' | 'theme'>, id?: UniqueEntityId): User {
    return new User({ ...props, theme: 'light', createdAt: new Date() }, id);
  }

  static reconstitute(props: UserProps, id: UniqueEntityId): User {
    return new User(props, id);
  }
}
