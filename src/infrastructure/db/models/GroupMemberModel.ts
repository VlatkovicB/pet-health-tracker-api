import { BelongsTo, Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { GroupModel } from './GroupModel';
import { UserModel } from './UserModel';

@Table({ tableName: 'group_members', timestamps: false })
export class GroupMemberModel extends Model {
  @PrimaryKey
  @ForeignKey(() => GroupModel)
  @Column(DataType.UUID)
  declare groupId: string;

  @PrimaryKey
  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  declare userId: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare role: string;

  @Column({ type: DataType.DATE, allowNull: false, field: 'joined_at' })
  declare joinedAt: Date;

  @BelongsTo(() => GroupModel)
  declare group: GroupModel;

  @BelongsTo(() => UserModel)
  declare user: UserModel;
}
