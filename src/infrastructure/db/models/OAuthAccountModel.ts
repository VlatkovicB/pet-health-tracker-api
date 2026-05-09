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

@Table({
  tableName: 'oauth_accounts',
  timestamps: false,
  indexes: [{ unique: true, fields: ['provider', 'provider_id'] }],
})
export class OAuthAccountModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  declare userId: string;

  @BelongsTo(() => UserModel)
  declare user: UserModel;

  @Column({
    type: DataType.ENUM('google', 'facebook', 'apple'),
    allowNull: false,
  })
  declare provider: 'google' | 'facebook' | 'apple';

  @Column({ type: DataType.STRING, allowNull: false, field: 'provider_id' })
  declare providerId: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare email: string | null;

  @Column({ type: DataType.DATE, allowNull: false, field: 'created_at' })
  declare createdAt: Date;
}
