import { Column, DataType, HasMany, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { ReminderNotifyUserModel } from './ReminderNotifyUserModel';

@Table({ tableName: 'reminders', timestamps: false })
export class ReminderModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false, field: 'entity_type' })
  declare entityType: string;

  @Column({ type: DataType.UUID, allowNull: false, field: 'entity_id' })
  declare entityId: string;

  @Column({ type: DataType.STRING, allowNull: false, field: 'schedule_type' })
  declare scheduleType: string;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'schedule_interval' })
  declare scheduleInterval: number;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare enabled: boolean;

  @Column({ type: DataType.UUID, allowNull: false, field: 'created_by' })
  declare createdBy: string;

  @Column({ type: DataType.DATE, allowNull: false, field: 'created_at' })
  declare createdAt: Date;

  @HasMany(() => ReminderNotifyUserModel)
  declare notifyUsers: ReminderNotifyUserModel[];
}
