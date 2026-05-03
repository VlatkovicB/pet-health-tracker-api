import { BelongsTo, Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { UserModel } from './UserModel';

@Table({ tableName: 'user_limits', timestamps: false })
export class UserLimitsModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: false, unique: true, field: 'user_id' })
  declare userId: string;

  @Column({ type: DataType.INTEGER, allowNull: true, field: 'max_pets' })
  declare maxPets: number | null;

  @Column({ type: DataType.INTEGER, allowNull: true, field: 'max_vets' })
  declare maxVets: number | null;

  @Column({ type: DataType.INTEGER, allowNull: true, field: 'max_medications' })
  declare maxMedications: number | null;

  @Column({ type: DataType.INTEGER, allowNull: true, field: 'max_notes' })
  declare maxNotes: number | null;

  @Column({ type: DataType.BIGINT, allowNull: true, field: 'max_storage_bytes' })
  declare maxStorageBytes: string | null;

  @Column({ type: DataType.BIGINT, allowNull: false, defaultValue: 0, field: 'storage_used_bytes' })
  declare storageUsedBytes: string;

  @Column({ type: DataType.INTEGER, allowNull: true, field: 'max_places_searches_monthly' })
  declare maxPlacesSearchesMonthly: number | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'places_searches_this_month' })
  declare placesSearchesThisMonth: number;

  @Column({ type: DataType.DATEONLY, allowNull: false, field: 'places_searches_month' })
  declare placesSearchesMonth: string;

  @Column({ type: DataType.DATE, allowNull: false, field: 'created_at' })
  declare createdAt: Date;

  @Column({ type: DataType.DATE, allowNull: false, field: 'updated_at' })
  declare updatedAt: Date;

  @BelongsTo(() => UserModel)
  declare user: UserModel;
}
