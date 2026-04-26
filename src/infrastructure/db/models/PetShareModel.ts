import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { UserModel } from './UserModel';
import { PetModel } from './PetModel';

@Table({ tableName: 'pet_shares', timestamps: false })
export class PetShareModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => PetModel)
  @Column({ type: DataType.UUID, allowNull: false, field: 'pet_id' })
  declare petId: string;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: false, field: 'owner_id' })
  declare ownerId: string;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: true, field: 'shared_with_user_id' })
  declare sharedWithUserId: string | null;

  @Column({ type: DataType.STRING, allowNull: false, field: 'invited_email' })
  declare invitedEmail: string;

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'pending' })
  declare status: string;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'can_view_vet_visits' })
  declare canViewVetVisits: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'can_edit_vet_visits' })
  declare canEditVetVisits: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'can_view_medications' })
  declare canViewMedications: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'can_edit_medications' })
  declare canEditMedications: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'can_view_notes' })
  declare canViewNotes: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'can_edit_notes' })
  declare canEditNotes: boolean;

  @Column({ type: DataType.DATE, allowNull: false, field: 'created_at' })
  declare createdAt: Date;

  @BelongsTo(() => PetModel, { foreignKey: 'pet_id' })
  declare pet: PetModel;

  @BelongsTo(() => UserModel, { foreignKey: 'owner_id', as: 'owner' })
  declare owner: UserModel;
}
