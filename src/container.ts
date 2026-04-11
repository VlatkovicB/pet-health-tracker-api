import { Container } from 'typedi';
import { SequelizeUserRepository } from './infrastructure/db/repositories/SequelizeUserRepository';
import { SequelizePetRepository } from './infrastructure/db/repositories/SequelizePetRepository';
import { SequelizeGroupRepository } from './infrastructure/db/repositories/SequelizeGroupRepository';
import { SequelizeHealthRecordRepository } from './infrastructure/db/repositories/SequelizeHealthRecordRepository';
import { SequelizeVetRepository } from './infrastructure/db/repositories/SequelizeVetRepository';
import { SequelizeReminderRepository } from './infrastructure/db/repositories/SequelizeReminderRepository';
import { USER_REPOSITORY } from './domain/user/UserRepository';
import { PET_REPOSITORY } from './domain/pet/PetRepository';
import { GROUP_REPOSITORY } from './domain/group/GroupRepository';
import { HEALTH_RECORD_REPOSITORY } from './domain/health/HealthRecordRepository';
import { VET_REPOSITORY } from './domain/vet/VetRepository';
import { REMINDER_REPOSITORY } from './domain/reminder/ReminderRepository';

export function registerDependencies(): void {
  Container.set(USER_REPOSITORY, Container.get(SequelizeUserRepository));
  Container.set(PET_REPOSITORY, Container.get(SequelizePetRepository));
  Container.set(GROUP_REPOSITORY, Container.get(SequelizeGroupRepository));
  Container.set(HEALTH_RECORD_REPOSITORY, Container.get(SequelizeHealthRecordRepository));
  Container.set(VET_REPOSITORY, Container.get(SequelizeVetRepository));
  Container.set(REMINDER_REPOSITORY, Container.get(SequelizeReminderRepository));
}
