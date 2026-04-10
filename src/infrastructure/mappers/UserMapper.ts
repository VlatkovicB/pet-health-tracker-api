import { Service } from 'typedi';
import { UserModel } from '../db/models/UserModel';
import { User } from '../../domain/user/User';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';

export interface UserResponseDto {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

@Service()
export class UserMapper {
  toDomain(model: UserModel): User {
    return User.reconstitute(
      {
        name: model.name,
        email: model.email,
        passwordHash: model.passwordHash,
        createdAt: model.createdAt,
      },
      new UniqueEntityId(model.id),
    );
  }

  toPersistence(user: User): object {
    return {
      id: user.id.toValue(),
      name: user.name,
      email: user.email,
      passwordHash: user.passwordHash,
      createdAt: user.createdAt,
    };
  }

  toResponse(user: User): UserResponseDto {
    return {
      id: user.id.toValue(),
      name: user.name,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
