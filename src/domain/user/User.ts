import { AggregateRoot } from '../shared/AggregateRoot';
import { UniqueEntityId } from '../shared/UniqueEntityId';
import { UserRole } from './UserRole';

export type ThemeMode = 'light' | 'dark';

interface UserProps {
  name: string;
  email: string;
  passwordHash: string | null;
  theme: ThemeMode;
  role: UserRole;
  createdAt: Date;
}

export class User extends AggregateRoot<UserProps> {
  get name(): string { return this.props.name; }
  get email(): string { return this.props.email; }
  get passwordHash(): string | null { return this.props.passwordHash; }
  get theme(): ThemeMode { return this.props.theme; }
  get role(): UserRole { return this.props.role; }
  get createdAt(): Date { return this.props.createdAt; }

  setTheme(mode: ThemeMode): void { this.props.theme = mode; }
  setRole(role: UserRole): void { this.props.role = role; }

  static create(props: Omit<UserProps, 'createdAt' | 'theme' | 'role'>, id?: UniqueEntityId): User {
    return new User({ ...props, theme: 'light', role: 'user', createdAt: new Date() }, id);
  }

  static reconstitute(props: UserProps, id: UniqueEntityId): User {
    return new User(props, id);
  }
}
