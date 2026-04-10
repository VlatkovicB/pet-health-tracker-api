import { Sequelize } from 'sequelize-typescript';
import { UserModel } from './models/UserModel';
import { PetModel } from './models/PetModel';
import { GroupModel } from './models/GroupModel';
import { GroupMemberModel } from './models/GroupMemberModel';
import { VetModel } from './models/VetModel';
import { VetVisitModel } from './models/VetVisitModel';
import { MedicationModel } from './models/MedicationModel';
import { SymptomModel } from './models/SymptomModel';
import { HealthCheckModel } from './models/HealthCheckModel';

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
    GroupModel,
    GroupMemberModel,
    VetModel,
    VetVisitModel,
    MedicationModel,
    SymptomModel,
    HealthCheckModel,
  ],
});
