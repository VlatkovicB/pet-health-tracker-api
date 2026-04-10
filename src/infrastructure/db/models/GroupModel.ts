import { Column, DataType, HasMany, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { GroupMemberModel } from './GroupMemberModel';
import { PetModel } from './PetModel';

@Table({ tableName: 'groups', timestamps: false })
export class GroupModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Column({ type: DataType.DATE, allowNull: false, field: 'created_at' })
  declare createdAt: Date;

  @HasMany(() => GroupMemberModel)
  declare members: GroupMemberModel[];

  @HasMany(() => PetModel)
  declare pets: PetModel[];
}
