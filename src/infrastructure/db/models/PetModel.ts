import { BelongsTo, Column, DataType, ForeignKey, HasMany, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { GroupModel } from './GroupModel';
import { MedicationModel } from './MedicationModel';
import { VetVisitModel } from './VetVisitModel';
import { SymptomModel } from './SymptomModel';
import { HealthCheckModel } from './HealthCheckModel';

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

  @ForeignKey(() => GroupModel)
  @Column({ type: DataType.UUID, allowNull: false, field: 'group_id' })
  declare groupId: string;

  @Column({ type: DataType.DATE, allowNull: false, field: 'created_at' })
  declare createdAt: Date;

  @BelongsTo(() => GroupModel)
  declare group: GroupModel;

  @HasMany(() => VetVisitModel)
  declare vetVisits: VetVisitModel[];

  @HasMany(() => MedicationModel)
  declare medications: MedicationModel[];

  @HasMany(() => SymptomModel)
  declare symptoms: SymptomModel[];

  @HasMany(() => HealthCheckModel)
  declare healthChecks: HealthCheckModel[];
}
