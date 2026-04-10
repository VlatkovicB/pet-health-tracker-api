import { BelongsTo, Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { PetModel } from './PetModel';

@Table({ tableName: 'symptoms', timestamps: false })
export class SymptomModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => PetModel)
  @Column({ type: DataType.UUID, allowNull: false, field: 'pet_id' })
  declare petId: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare description: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare severity: string;

  @Column({ type: DataType.DATE, allowNull: false, field: 'observed_at' })
  declare observedAt: Date;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare notes: string | null;

  @Column({ type: DataType.DATE, allowNull: true, field: 'resolved_at' })
  declare resolvedAt: Date | null;

  @Column({ type: DataType.UUID, allowNull: false, field: 'created_by' })
  declare createdBy: string;

  @Column({ type: DataType.DATE, allowNull: false, field: 'created_at' })
  declare createdAt: Date;

  @BelongsTo(() => PetModel)
  declare pet: PetModel;
}
