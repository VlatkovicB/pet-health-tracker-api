import { BelongsTo, Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { ReminderModel } from './ReminderModel';
import { UserModel } from './UserModel';

@Table({ tableName: 'reminder_notify_users', timestamps: false })
export class ReminderNotifyUserModel extends Model {
  @PrimaryKey
  @ForeignKey(() => ReminderModel)
  @Column({ type: DataType.UUID, field: 'reminder_id' })
  declare reminderId: string;

  @PrimaryKey
  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, field: 'user_id' })
  declare userId: string;

  @BelongsTo(() => ReminderModel)
  declare reminder: ReminderModel;

  @BelongsTo(() => UserModel)
  declare user: UserModel;
}
