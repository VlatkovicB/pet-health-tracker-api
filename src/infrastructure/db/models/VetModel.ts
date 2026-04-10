import { BelongsTo, Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { GroupModel } from './GroupModel';

@Table({ tableName: 'vets', timestamps: false })
export class VetModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => GroupModel)
  @Column({ type: DataType.UUID, allowNull: false, field: 'group_id' })
  declare groupId: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare address: string | null;

  @Column({ type: DataType.STRING, allowNull: true })
  declare phone: string | null;

  @Column({ type: DataType.STRING, allowNull: true, field: 'work_hours' })
  declare workHours: string | null;

  @Column({ type: DataType.STRING, allowNull: true, field: 'google_maps_url' })
  declare googleMapsUrl: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare notes: string | null;

  @Column({ type: DataType.DATE, allowNull: false, field: 'created_at' })
  declare createdAt: Date;

  @BelongsTo(() => GroupModel)
  declare group: GroupModel;
}
