import { Column, DataType, HasMany, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { ReminderNotifyUserModel } from './ReminderNotifyUserModel';
import { ReminderScheduleProps } from '../../../domain/health/value-objects/ReminderSchedule';
import type { AdvanceNotice } from '../../../domain/reminder/Reminder';

@Table({ tableName: 'reminders', timestamps: false })
export class ReminderModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false, field: 'entity_type' })
  declare entityType: string;

  @Column({ type: DataType.UUID, allowNull: false, field: 'entity_id' })
  declare entityId: string;

  @Column({ type: DataType.JSONB, allowNull: false })
  declare schedule: ReminderScheduleProps;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare enabled: boolean;

  @Column({ type: DataType.JSONB, allowNull: true, field: 'advance_notice' })
  declare advanceNotice: AdvanceNotice | null;

  @Column({ type: DataType.UUID, allowNull: false, field: 'created_by' })
  declare createdBy: string;

  @Column({ type: DataType.DATE, allowNull: false, field: 'created_at' })
  declare createdAt: Date;

  @HasMany(() => ReminderNotifyUserModel)
  declare notifyUsers: ReminderNotifyUserModel[];
}
