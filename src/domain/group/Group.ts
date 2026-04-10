import { AggregateRoot } from '../shared/AggregateRoot';
import { UniqueEntityId } from '../shared/UniqueEntityId';

export type GroupRole = 'owner' | 'member';

export interface GroupMember {
  userId: string;
  role: GroupRole;
  joinedAt: Date;
}

interface GroupProps {
  name: string;
  members: GroupMember[];
  createdAt: Date;
}

export class Group extends AggregateRoot<GroupProps> {
  get name(): string { return this.props.name; }
  get members(): GroupMember[] { return this.props.members; }
  get createdAt(): Date { return this.props.createdAt; }

  addMember(userId: string, role: GroupRole = 'member'): void {
    const exists = this.props.members.some((m) => m.userId === userId);
    if (exists) throw new Error('User is already a member of this group');
    this.props.members.push({ userId, role, joinedAt: new Date() });
  }

  removeMember(userId: string): void {
    const index = this.props.members.findIndex((m) => m.userId === userId);
    if (index === -1) throw new Error('User is not a member of this group');
    this.props.members.splice(index, 1);
  }

  hasMember(userId: string): boolean {
    return this.props.members.some((m) => m.userId === userId);
  }

  getMemberRole(userId: string): GroupRole | null {
    return this.props.members.find((m) => m.userId === userId)?.role ?? null;
  }

  static create(name: string, ownerUserId: string, id?: UniqueEntityId): Group {
    return new Group(
      {
        name,
        members: [{ userId: ownerUserId, role: 'owner', joinedAt: new Date() }],
        createdAt: new Date(),
      },
      id,
    );
  }

  static reconstitute(props: GroupProps, id: UniqueEntityId): Group {
    return new Group(props, id);
  }
}
