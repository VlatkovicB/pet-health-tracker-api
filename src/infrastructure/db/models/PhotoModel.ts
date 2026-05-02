import { BelongsTo, Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { PetModel } from './PetModel';
import { UserModel } from './UserModel';
import { PhotoSourceType } from '../../../domain/photo/Photo';

@Table({ tableName: 'photos', timestamps: false })
export class PhotoModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => PetModel)
  @Column({ type: DataType.UUID, allowNull: false, field: 'pet_id' })
  declare petId: string;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: false, field: 'owner_id' })
  declare ownerId: string;

  @Column({ type: DataType.STRING, allowNull: false, unique: true, field: 's3_key' })
  declare s3Key: string;

  @Column({ type: DataType.DATEONLY, allowNull: false, field: 'taken_at' })
  declare takenAt: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare caption: string | null;

  @Column({ type: DataType.ENUM('standalone', 'vet-visit', 'note', 'weight-entry'), allowNull: false, field: 'source_type' })
  declare sourceType: PhotoSourceType;

  @Column({ type: DataType.UUID, allowNull: true, field: 'source_id' })
  declare sourceId: string | null;

  @Column({ type: DataType.DATE, allowNull: false, field: 'created_at' })
  declare createdAt: Date;

  @BelongsTo(() => PetModel)
  declare pet: PetModel;

  @BelongsTo(() => UserModel)
  declare owner: UserModel;
}
