import { AggregateRoot } from '../shared/AggregateRoot';
import { UniqueEntityId } from '../shared/UniqueEntityId';

interface UserProps {
  name: string;
  email: string;
  passwordHash: string;
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

  get createdAt(): Date {
    return this.props.createdAt;
  }

  static create(props: Omit<UserProps, 'createdAt'>, id?: UniqueEntityId): User {
    return new User({ ...props, createdAt: new Date() }, id);
  }

  static reconstitute(props: UserProps, id: UniqueEntityId): User {
    return new User(props, id);
  }
}
