import 'reflect-metadata';
import { UpdateUserRoleUseCase } from '../../../src/application/admin/UpdateUserRoleUseCase';
import { UserRepository } from '../../../src/domain/user/UserRepository';
import { NotFoundError, ForbiddenError } from '../../../src/shared/errors/AppError';
import { User } from '../../../src/domain/user/User';
import { UniqueEntityId } from '../../../src/domain/shared/UniqueEntityId';

function makeUser(id: string, role: 'user' | 'admin' = 'user'): User {
  return User.reconstitute(
    { name: 'Test', email: 'test@test.com', passwordHash: 'hash', theme: 'light', role, createdAt: new Date() },
    new UniqueEntityId(id),
  );
}

describe('UpdateUserRoleUseCase', () => {
  it('throws NotFoundError when user not found', async () => {
    const repo = {
      findById: jest.fn().mockResolvedValue(null),
      updateRole: jest.fn().mockResolvedValue(undefined),
    } as unknown as UserRepository;
    const uc = new UpdateUserRoleUseCase(repo);
    await expect(uc.execute({ targetUserId: 'u1', role: 'admin', requestingUserId: 'admin1' }))
      .rejects.toThrow(NotFoundError);
  });

  it('throws ForbiddenError when trying to change own role', async () => {
    const admin = makeUser('admin1', 'admin');
    const repo = {
      findById: jest.fn().mockResolvedValue(admin),
      updateRole: jest.fn().mockResolvedValue(undefined),
    } as unknown as UserRepository;
    const uc = new UpdateUserRoleUseCase(repo);
    await expect(uc.execute({ targetUserId: 'admin1', role: 'user', requestingUserId: 'admin1' }))
      .rejects.toThrow(ForbiddenError);
  });

  it('updates role successfully', async () => {
    const user = makeUser('u1');
    const repo = {
      findById: jest.fn().mockResolvedValue(user),
      updateRole: jest.fn().mockResolvedValue(undefined),
    } as unknown as UserRepository;
    const uc = new UpdateUserRoleUseCase(repo);
    await uc.execute({ targetUserId: 'u1', role: 'admin', requestingUserId: 'admin1' });
    expect(repo.updateRole).toHaveBeenCalledWith('u1', 'admin');
  });
});
