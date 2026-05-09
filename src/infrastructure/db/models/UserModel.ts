import { Column, DataType, HasMany, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { PetModel } from './PetModel';
import { OAuthAccountModel } from './OAuthAccountModel';

@Table({ tableName: 'users', timestamps: false })
export class UserModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  declare email: string;

  @Column({ type: DataType.STRING, allowNull: true, field: 'password_hash' })
  declare passwordHash: string | null;

  @Column({ type: DataType.ENUM('light', 'dark'), allowNull: false, defaultValue: 'light' })
  declare theme: 'light' | 'dark';

  @Column({ type: DataType.ENUM('user', 'admin'), allowNull: false, defaultValue: 'user' })
  declare role: 'user' | 'admin';

  @Column({ type: DataType.DATE, allowNull: false, field: 'created_at' })
  declare createdAt: Date;

  @HasMany(() => PetModel)
  declare pets: PetModel[];

  @HasMany(() => OAuthAccountModel, { onDelete: 'CASCADE' })
  declare oauthAccounts: OAuthAccountModel[];
}
