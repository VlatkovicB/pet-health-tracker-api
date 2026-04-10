import { Service } from 'typedi';
import { GroupModel } from '../db/models/GroupModel';
import { Group, GroupMember, GroupRole } from '../../domain/group/Group';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';

export interface GroupMemberResponseDto {
  userId: string;
  role: GroupRole;
  joinedAt: string;
}

export interface GroupResponseDto {
  id: string;
  name: string;
  members: GroupMemberResponseDto[];
  createdAt: string;
}

@Service()
export class GroupMapper {
  toDomain(model: GroupModel): Group {
    const members: GroupMember[] = (model.members ?? []).map((m) => ({
      userId: m.userId,
      role: m.role as GroupRole,
      joinedAt: m.joinedAt,
    }));

    return Group.reconstitute(
      { name: model.name, members, createdAt: model.createdAt },
      new UniqueEntityId(model.id),
    );
  }

  toPersistence(group: Group): object {
    return {
      id: group.id.toValue(),
      name: group.name,
      createdAt: group.createdAt,
    };
  }

  membersForPersistence(group: Group): object[] {
    return group.members.map((m) => ({
      groupId: group.id.toValue(),
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  toResponse(group: Group): GroupResponseDto {
    return {
      id: group.id.toValue(),
      name: group.name,
      members: group.members.map((m) => ({
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      })),
      createdAt: group.createdAt.toISOString(),
    };
  }
}
