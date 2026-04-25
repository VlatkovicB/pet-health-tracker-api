import { Container } from 'typedi';
import { SequelizeUserRepository } from './infrastructure/db/repositories/SequelizeUserRepository';
import { SequelizePetRepository } from './infrastructure/db/repositories/SequelizePetRepository';
import { SequelizeHealthRecordRepository } from './infrastructure/db/repositories/SequelizeHealthRecordRepository';
import { SequelizeVetRepository } from './infrastructure/db/repositories/SequelizeVetRepository';
import { SequelizeReminderRepository } from './infrastructure/db/repositories/SequelizeReminderRepository';
import { SequelizeNoteRepository } from './infrastructure/db/repositories/SequelizeNoteRepository';
import { SequelizePetShareRepository } from './infrastructure/db/repositories/SequelizePetShareRepository';
import { SequelizePetOwnershipTransferRepository } from './infrastructure/db/repositories/SequelizePetOwnershipTransferRepository';
import { NOTE_REPOSITORY } from './domain/note/NoteRepository';
import { PET_SHARE_REPOSITORY } from './domain/share/PetShareRepository';
import { PET_OWNERSHIP_TRANSFER_REPOSITORY } from './domain/transfer/PetOwnershipTransferRepository';
import { USER_REPOSITORY } from './domain/user/UserRepository';
import { PET_REPOSITORY } from './domain/pet/PetRepository';
import { HEALTH_RECORD_REPOSITORY } from './domain/health/HealthRecordRepository';
import { VET_REPOSITORY } from './domain/vet/VetRepository';
import { REMINDER_REPOSITORY } from './domain/reminder/ReminderRepository';

export function registerDependencies(): void {
  Container.set(USER_REPOSITORY, Container.get(SequelizeUserRepository));
  Container.set(PET_REPOSITORY, Container.get(SequelizePetRepository));
  Container.set(HEALTH_RECORD_REPOSITORY, Container.get(SequelizeHealthRecordRepository));
  Container.set(VET_REPOSITORY, Container.get(SequelizeVetRepository));
  Container.set(REMINDER_REPOSITORY, Container.get(SequelizeReminderRepository));
  Container.set(NOTE_REPOSITORY, Container.get(SequelizeNoteRepository));
  Container.set(PET_SHARE_REPOSITORY, Container.get(SequelizePetShareRepository));
  Container.set(PET_OWNERSHIP_TRANSFER_REPOSITORY, Container.get(SequelizePetOwnershipTransferRepository));
}
