import { BelongsTo, Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { VetModel } from './VetModel';

@Table({ tableName: 'vet_work_hours', timestamps: false })
export class VetWorkHoursModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => VetModel)
  @Column({ type: DataType.UUID, allowNull: false, field: 'vet_id' })
  declare vetId: string;

  @Column({
    type: DataType.ENUM('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'),
    allowNull: false,
    field: 'day_of_week',
  })
  declare dayOfWeek: string;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare open: boolean;

  @Column({ type: DataType.STRING(5), allowNull: true, field: 'start_time' })
  declare startTime: string | null;

  @Column({ type: DataType.STRING(5), allowNull: true, field: 'end_time' })
  declare endTime: string | null;

  @BelongsTo(() => VetModel)
  declare vet: VetModel;
}
