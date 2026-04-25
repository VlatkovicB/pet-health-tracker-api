import { Sequelize } from 'sequelize-typescript';
import { UserModel } from './models/UserModel';
import { PetModel } from './models/PetModel';
import { VetModel } from './models/VetModel';
import { VetWorkHoursModel } from './models/VetWorkHoursModel';
import { VetVisitModel } from './models/VetVisitModel';
import { MedicationModel } from './models/MedicationModel';
import { ReminderModel } from './models/ReminderModel';
import { ReminderNotifyUserModel } from './models/ReminderNotifyUserModel';
import { NoteModel } from './models/NoteModel';
import { NotePetTagModel } from './models/NotePetTagModel';
import { PetShareModel } from './models/PetShareModel';
import { PetOwnershipTransferModel } from './models/PetOwnershipTransferModel';

export const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? 'pet_health_tracker',
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  logging: false,
  models: [
    UserModel,
    PetModel,
    VetModel,
    VetWorkHoursModel,
    VetVisitModel,
    MedicationModel,
    ReminderModel,
    ReminderNotifyUserModel,
    NoteModel,
    NotePetTagModel,
    PetShareModel,
    PetOwnershipTransferModel,
  ],
});
