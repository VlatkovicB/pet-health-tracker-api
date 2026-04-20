import { BelongsTo, Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { PetModel } from './PetModel';
import type { ReminderScheduleProps } from '../../../domain/health/value-objects/ReminderSchedule';

@Table({ tableName: 'medications', timestamps: false })
export class MedicationModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => PetModel)
  @Column({ type: DataType.UUID, allowNull: false, field: 'pet_id' })
  declare petId: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Column({ type: DataType.FLOAT, allowNull: false, field: 'dosage_amount' })
  declare dosageAmount: number;

  @Column({ type: DataType.STRING, allowNull: false, field: 'dosage_unit' })
  declare dosageUnit: string;

  @Column({ type: DataType.JSONB, allowNull: true })
  declare schedule: ReminderScheduleProps;

  @Column({ type: DataType.DATE, allowNull: false, field: 'start_date' })
  declare startDate: Date;

  @Column({ type: DataType.DATE, allowNull: true, field: 'end_date' })
  declare endDate: Date | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare notes: string | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare active: boolean;

  @Column({ type: DataType.UUID, allowNull: false, field: 'created_by' })
  declare createdBy: string;

  @Column({ type: DataType.DATE, allowNull: false, field: 'created_at' })
  declare createdAt: Date;

  @BelongsTo(() => PetModel)
  declare pet: PetModel;
}
