import { Column, DataType, HasMany, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { GroupMemberModel } from './GroupMemberModel';

@Table({ tableName: 'users', timestamps: false })
export class UserModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  declare email: string;

  @Column({ type: DataType.STRING, allowNull: false, field: 'password_hash' })
  declare passwordHash: string;

  @Column({ type: DataType.DATE, allowNull: false, field: 'created_at' })
  declare createdAt: Date;

  @HasMany(() => GroupMemberModel)
  declare groupMemberships: GroupMemberModel[];
}
