import { BelongsTo, Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { PetModel } from './PetModel';

@Table({ tableName: 'health_checks', timestamps: false })
export class HealthCheckModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => PetModel)
  @Column({ type: DataType.UUID, allowNull: false, field: 'pet_id' })
  declare petId: string;

  @Column({ type: DataType.FLOAT, allowNull: true, field: 'weight_kg' })
  declare weightKg: number | null;

  @Column({ type: DataType.FLOAT, allowNull: true, field: 'temperature_c' })
  declare temperatureC: number | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare notes: string | null;

  @Column({ type: DataType.DATE, allowNull: false, field: 'checked_at' })
  declare checkedAt: Date;

  @Column({ type: DataType.UUID, allowNull: false, field: 'created_by' })
  declare createdBy: string;

  @Column({ type: DataType.DATE, allowNull: false, field: 'created_at' })
  declare createdAt: Date;

  @BelongsTo(() => PetModel)
  declare pet: PetModel;
}
