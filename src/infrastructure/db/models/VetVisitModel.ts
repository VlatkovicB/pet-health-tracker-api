import { BelongsTo, Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { PetModel } from './PetModel';
import { VetModel } from './VetModel';

@Table({ tableName: 'vet_visits', timestamps: false })
export class VetVisitModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => PetModel)
  @Column({ type: DataType.UUID, allowNull: false, field: 'pet_id' })
  declare petId: string;

  @ForeignKey(() => VetModel)
  @Column({ type: DataType.UUID, allowNull: true, field: 'vet_id' })
  declare vetId: string | null;

  @Column({ type: DataType.DATE, allowNull: false, field: 'visit_date' })
  declare visitDate: Date;

  @Column({ type: DataType.STRING, allowNull: true })
  declare clinic: string | null;

  @Column({ type: DataType.STRING, allowNull: true, field: 'vet_name' })
  declare vetName: string | null;

  @Column({ type: DataType.STRING, allowNull: false })
  declare reason: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare notes: string | null;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: [], field: 'image_urls' })
  declare imageUrls: string[];

  @Column({ type: DataType.DATE, allowNull: true, field: 'next_visit_date' })
  declare nextVisitDate: Date | null;

  @Column({ type: DataType.UUID, allowNull: false, field: 'created_by' })
  declare createdBy: string;

  @Column({ type: DataType.DATE, allowNull: false, field: 'created_at' })
  declare createdAt: Date;

  @BelongsTo(() => PetModel)
  declare pet: PetModel;

  @BelongsTo(() => VetModel)
  declare vet: VetModel;
}
