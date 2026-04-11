import { Reminder } from './Reminder';

export const REMINDER_REPOSITORY = 'REMINDER_REPOSITORY';

export interface ReminderRepository {
  findById(id: string): Promise<Reminder | null>;
  findByEntityId(entityId: string): Promise<Reminder | null>;
  findAllEnabled(): Promise<Reminder[]>;
  save(reminder: Reminder): Promise<void>;
  delete(id: string): Promise<void>;
}
