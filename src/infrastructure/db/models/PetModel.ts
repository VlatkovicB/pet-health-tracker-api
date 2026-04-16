import { BelongsTo, Column, DataType, ForeignKey, HasMany, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { UserModel } from './UserModel';
import { MedicationModel } from './MedicationModel';
import { VetVisitModel } from './VetVisitModel';

@Table({ tableName: 'pets', timestamps: false })
export class PetModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare species: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare breed: string | null;

  @Column({ type: DataType.DATE, allowNull: true, field: 'birth_date' })
  declare birthDate: Date | null;

  @Column({ type: DataType.STRING, allowNull: true, field: 'photo_url' })
  declare photoUrl: string | null;

  @Column({ type: DataType.STRING(7), allowNull: true })
  declare color: string | null;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  declare userId: string;

  @Column({ type: DataType.DATE, allowNull: false, field: 'created_at' })
  declare createdAt: Date;

  @BelongsTo(() => UserModel)
  declare user: UserModel;

  @HasMany(() => VetVisitModel)
  declare vetVisits: VetVisitModel[];

  @HasMany(() => MedicationModel)
  declare medications: MedicationModel[];
}
