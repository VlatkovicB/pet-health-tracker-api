/**
 * Seed script — creates realistic demo data:
 *   1 group, 1 owner user
 *   10 vets
 *   5 pets  (each with 10 past vet visits + 3 medications)
 *
 * Run:
 *   pnpm ts-node --project tsconfig.json scripts/seed.ts
 */

import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { Sequelize } from 'sequelize-typescript';

// --- models (import after reflect-metadata) ---
import { UserModel } from '../src/infrastructure/db/models/UserModel';
import { GroupModel } from '../src/infrastructure/db/models/GroupModel';
import { GroupMemberModel } from '../src/infrastructure/db/models/GroupMemberModel';
import { PetModel } from '../src/infrastructure/db/models/PetModel';
import { VetModel } from '../src/infrastructure/db/models/VetModel';
import { VetVisitModel } from '../src/infrastructure/db/models/VetVisitModel';
import { MedicationModel } from '../src/infrastructure/db/models/MedicationModel';
import { SymptomModel } from '../src/infrastructure/db/models/SymptomModel';
import { HealthCheckModel } from '../src/infrastructure/db/models/HealthCheckModel';
import { ReminderModel } from '../src/infrastructure/db/models/ReminderModel';
import { ReminderNotifyUserModel } from '../src/infrastructure/db/models/ReminderNotifyUserModel';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function monthsAgo(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}

function yearsAgo(n: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d;
}

// ---------------------------------------------------------------------------
// data
// ---------------------------------------------------------------------------

const VETS = [
  { name: 'Dr. Sarah Mitchell',   address: '14 Oak Street, Springfield',     phone: '555-0101', workHours: 'Mon–Fri 8am–6pm' },
  { name: 'Dr. James Thornton',   address: '87 Maple Ave, Riverside',         phone: '555-0102', workHours: 'Tue–Sat 9am–5pm' },
  { name: 'Dr. Elena Vasquez',    address: '230 Pine Road, Lakewood',         phone: '555-0103', workHours: 'Mon–Thu 8am–7pm' },
  { name: 'Dr. Kevin Park',       address: '5 Birch Lane, Greenfield',        phone: '555-0104', workHours: 'Mon–Fri 9am–6pm' },
  { name: 'Dr. Patricia Owens',   address: '112 Elm Blvd, Maplewood',        phone: '555-0105', workHours: 'Wed–Sun 10am–6pm' },
  { name: 'Dr. Robert Huang',     address: '78 Cedar Court, Fairview',        phone: '555-0106', workHours: 'Mon–Fri 8am–5pm' },
  { name: 'Dr. Amanda Foster',    address: '33 Willow Way, Sunnyside',        phone: '555-0107', workHours: 'Tue–Sat 8am–6pm' },
  { name: 'Dr. Marcus Bell',      address: '9 Aspen Drive, Clearwater',       phone: '555-0108', workHours: 'Mon–Fri 9am–7pm' },
  { name: 'Dr. Linda Nguyen',     address: '60 Spruce Street, Hillside',      phone: '555-0109', workHours: 'Mon–Sat 9am–5pm' },
  { name: 'Dr. Thomas Caldwell',  address: '200 Redwood Blvd, Forestville',   phone: '555-0110', workHours: 'Mon–Fri 8am–6pm' },
];

const PETS: Array<{
  name: string;
  species: string;
  breed: string;
  birthDate: Date;
}> = [
  { name: 'Biscuit',  species: 'Dog', breed: 'Golden Retriever', birthDate: yearsAgo(4)  },
  { name: 'Luna',     species: 'Cat', breed: 'Maine Coon',        birthDate: yearsAgo(3)  },
  { name: 'Peanut',   species: 'Dog', breed: 'Beagle',            birthDate: yearsAgo(6)  },
  { name: 'Whiskers', species: 'Cat', breed: 'Scottish Fold',     birthDate: yearsAgo(2)  },
  { name: 'Max',      species: 'Dog', breed: 'German Shepherd',   birthDate: yearsAgo(5)  },
];

// 10 visit templates per pet — each tuple: [daysAgoN, reason, clinic, notes]
type VisitTemplate = [number, string, string, string];

const VISIT_TEMPLATES: VisitTemplate[][] = [
  // Biscuit
  [
    [20,  'Annual wellness exam',              'Paws & Claws Clinic',        'Vaccinations up to date. Weight 32 kg — on target.'],
    [55,  'Limping on front left leg',         'Paws & Claws Clinic',        'Minor sprain. Rest for one week. Anti-inflammatories prescribed.'],
    [120, 'Skin rash on belly',                'Riverside Animal Hospital',   'Allergic reaction. Antihistamines given. Recommend hypoallergenic diet.'],
    [180, 'Dental cleaning',                   'Paws & Claws Clinic',        'Moderate tartar removed. No extractions needed.'],
    [240, 'Ear infection',                     'Greenfield Vet Centre',       'Bacterial otitis. Ear drops for 10 days.'],
    [300, 'Annual wellness exam',              'Paws & Claws Clinic',        'Healthy. Booster shots administered.'],
    [380, 'Vomiting and lethargy',             'Riverside Animal Hospital',   'Ate something inappropriate. IV fluids overnight. Discharged next day.'],
    [450, 'Lump on shoulder',                  'Greenfield Vet Centre',       'Benign lipoma. Monitoring only.'],
    [520, 'Eye discharge',                     'Paws & Claws Clinic',        'Mild conjunctivitis. Eye drops twice daily for 7 days.'],
    [600, 'Annual wellness exam',              'Paws & Claws Clinic',        'Good health. Weight slightly elevated — increase exercise.'],
  ],
  // Luna
  [
    [15,  'Annual wellness exam',              'Feline Friends Clinic',       'Healthy. Indoor-only — rabies waived. FeLV negative.'],
    [50,  'Not eating for 2 days',             'Feline Friends Clinic',       'Dental pain. One molar extracted. Soft food for 2 weeks.'],
    [100, 'Hairball issues',                   'Lakewood Pet Hospital',       'Laxatone recommended. Add fibre to diet.'],
    [160, 'Upper respiratory infection',       'Feline Friends Clinic',       'Viral URI. Lysine supplement + supportive care.'],
    [220, 'Annual wellness exam',              'Feline Friends Clinic',       'Weight 5.2 kg. All clear.'],
    [290, 'Limping on hind leg',               'Lakewood Pet Hospital',       'Soft tissue injury. NSAIDs for 5 days. Cage rest.'],
    [360, 'Urinary straining',                 'Feline Friends Clinic',       'FIC episode. Increased water intake recommended. Stress reduction.'],
    [430, 'Vomiting after eating',             'Lakewood Pet Hospital',       'Food sensitivity. Switch to hydrolyzed protein diet.'],
    [500, 'Annual wellness exam',              'Feline Friends Clinic',       'Healthy. Mild tartar — schedule dental next year.'],
    [580, 'Ear mites',                         'Feline Friends Clinic',       'Topical treatment applied. Recheck in 3 weeks.'],
  ],
  // Peanut
  [
    [10,  'Annual wellness exam',              'Beagle Bay Vet',              'Fit and healthy. Bordetella booster given.'],
    [45,  'Swallowed a sock',                  'Emergency Animal Care',       'Induced vomiting — sock retrieved. Monitoring 24 h. No obstruction.'],
    [110, 'Cherry eye',                        'Beagle Bay Vet',              'Surgical correction. Recovery 2 weeks.'],
    [170, 'Annual wellness exam',              'Beagle Bay Vet',              'Weight 11.5 kg. Good condition.'],
    [230, 'Tick removal and Lyme test',        'Riverside Animal Hospital',   'Lyme negative. Preventive collar prescribed.'],
    [295, 'Coughing fits',                     'Beagle Bay Vet',              'Kennel cough. Antibiotics + rest. No boarding for 3 weeks.'],
    [365, 'Annual wellness exam',              'Beagle Bay Vet',              'Healthy. Dental score 2/4 — recommend cleaning.'],
    [425, 'Paw pad cut',                       'Beagle Bay Vet',              'Deep laceration. Sutured. Cone for 10 days.'],
    [490, 'Weight check',                      'Beagle Bay Vet',              'Lost 0.8 kg since last visit. Diet adjusted.'],
    [560, 'Seasonal allergies',                'Riverside Animal Hospital',   'Apoquel prescribed. Review in 6 weeks.'],
  ],
  // Whiskers
  [
    [8,   'First kitten exam',                 'City Cat Clinic',             'Healthy kitten. First FVRCP given. Dewormer administered.'],
    [40,  'Spay surgery',                      'City Cat Clinic',             'Routine spay. No complications. E-collar for 10 days.'],
    [95,  'Sneezing and nasal discharge',      'City Cat Clinic',             'Herpesvirus flare. L-Lysine supplementation started.'],
    [155, 'Annual wellness exam',              'City Cat Clinic',             'Weight 3.8 kg. Growing well. Booster shots done.'],
    [210, 'Diarrhoea for 3 days',              'Maplewood Animal Hospital',  'Giardia. Metronidazole course. Probiotic supplement.'],
    [270, 'Eye ulcer',                         'City Cat Clinic',             'Corneal ulcer right eye. Triple antibiotic ophthalmic drops.'],
    [340, 'Overgrooming and bald patches',     'Maplewood Animal Hospital',  'Stress-induced alopecia. Environmental enrichment plan provided.'],
    [400, 'Annual wellness exam',              'City Cat Clinic',             'Healthy. Weight 4.1 kg. Mild gingivitis noted.'],
    [465, 'Vomiting hairballs frequently',     'City Cat Clinic',             'Diet change to hairball control formula. Regular brushing advised.'],
    [530, 'Flea infestation',                  'Maplewood Animal Hospital',  'Revolution Plus applied. Treat home environment.'],
  ],
  // Max
  [
    [12,  'Hip dysplasia check',               'Shepherd Specialty Vet',     'Mild bilateral HD. Joint supplement started. Monitor for pain.'],
    [60,  'Annual wellness exam',              'Shepherd Specialty Vet',     'Good condition. Core vaccines given.'],
    [125, 'Degloving injury on tail',          'Emergency Animal Care',       'Surgical repair. Bandage changes every 2 days. Full recovery expected.'],
    [185, 'Bloat scare',                       'Emergency Animal Care',       'GDV ruled out. Gas. Walk slowly after meals. Consider gastropexy.'],
    [245, 'Annual wellness exam',              'Shepherd Specialty Vet',     'Hip score stable. Weight 34 kg. Good muscle tone.'],
    [310, 'Diarrhoea and blood in stool',      'Shepherd Specialty Vet',     'HGE episode. IV fluids. Bland diet 5 days.'],
    [375, 'Limping on hind right',             'Shepherd Specialty Vet',     'Cruciate ligament partial tear. Physio + NSAIDs. Surgery may be needed.'],
    [440, 'Dental cleaning',                   'Shepherd Specialty Vet',     'Heavy tartar. Two premolars extracted. Antibiotics 7 days.'],
    [510, 'Annual wellness exam',              'Shepherd Specialty Vet',     'Healthy apart from mild arthritis. Carprofen as needed.'],
    [575, 'Recheck hind leg',                  'Shepherd Specialty Vet',     'Cruciate holding stable. Continue physio. No surgery needed for now.'],
  ],
];

// 3 medication templates per pet
type MedTemplate = {
  name: string;
  dosageAmount: number;
  dosageUnit: string;
  frequencyType: 'hourly' | 'daily' | 'weekly' | 'monthly';
  frequencyInterval: number;
  startDate: Date;
  endDate: Date | null;
  active: boolean;
  notes: string | null;
};

const MED_TEMPLATES: MedTemplate[][] = [
  // Biscuit
  [
    { name: 'Apoquel',         dosageAmount: 16,  dosageUnit: 'mg',        frequencyType: 'daily',   frequencyInterval: 1,  startDate: monthsAgo(4),  endDate: null,          active: true,  notes: 'For seasonal allergies' },
    { name: 'Carprofen',       dosageAmount: 75,  dosageUnit: 'mg',        frequencyType: 'daily',   frequencyInterval: 2,  startDate: monthsAgo(18), endDate: monthsAgo(16), active: false, notes: 'Prescribed after sprain' },
    { name: 'Simparica Trio',  dosageAmount: 1,   dosageUnit: 'tab',       frequencyType: 'monthly', frequencyInterval: 1,  startDate: monthsAgo(12), endDate: null,          active: true,  notes: 'Flea, tick and heartworm prevention' },
  ],
  // Luna
  [
    { name: 'L-Lysine',        dosageAmount: 500, dosageUnit: 'mg',        frequencyType: 'daily',   frequencyInterval: 2,  startDate: monthsAgo(8),  endDate: null,          active: true,  notes: 'Herpesvirus management — add to food' },
    { name: 'Metronidazole',   dosageAmount: 50,  dosageUnit: 'mg',        frequencyType: 'daily',   frequencyInterval: 2,  startDate: monthsAgo(14), endDate: monthsAgo(13), active: false, notes: 'Short course for GI upset' },
    { name: 'Revolution Plus', dosageAmount: 1,   dosageUnit: 'pip',       frequencyType: 'monthly', frequencyInterval: 1,  startDate: monthsAgo(6),  endDate: null,          active: true,  notes: 'Topical parasite prevention' },
  ],
  // Peanut
  [
    { name: 'Apoquel',         dosageAmount: 5.4, dosageUnit: 'mg',        frequencyType: 'daily',   frequencyInterval: 1,  startDate: monthsAgo(2),  endDate: null,          active: true,  notes: 'Allergy management — reassess in 2 months' },
    { name: 'Doxycycline',     dosageAmount: 100, dosageUnit: 'mg',        frequencyType: 'daily',   frequencyInterval: 2,  startDate: monthsAgo(10), endDate: monthsAgo(9),  active: false, notes: 'Kennel cough treatment' },
    { name: 'Seresto collar',  dosageAmount: 1,   dosageUnit: 'collar',    frequencyType: 'monthly', frequencyInterval: 8,  startDate: monthsAgo(5),  endDate: null,          active: true,  notes: 'Tick prevention' },
  ],
  // Whiskers
  [
    { name: 'L-Lysine',        dosageAmount: 250, dosageUnit: 'mg',        frequencyType: 'daily',   frequencyInterval: 1,  startDate: monthsAgo(9),  endDate: null,          active: true,  notes: 'Herpesvirus — mixed into wet food' },
    { name: 'Metronidazole',   dosageAmount: 25,  dosageUnit: 'mg',        frequencyType: 'daily',   frequencyInterval: 2,  startDate: monthsAgo(11), endDate: monthsAgo(10), active: false, notes: 'Giardia treatment' },
    { name: 'Purina Calming',  dosageAmount: 1,   dosageUnit: 'tab',       frequencyType: 'daily',   frequencyInterval: 1,  startDate: monthsAgo(5),  endDate: null,          active: true,  notes: 'Stress reduction supplement' },
  ],
  // Max
  [
    { name: 'Librela',         dosageAmount: 1,   dosageUnit: 'injection', frequencyType: 'monthly', frequencyInterval: 1,  startDate: monthsAgo(3),  endDate: null,          active: true,  notes: 'Monoclonal antibody — hip arthritis pain' },
    { name: 'Carprofen',       dosageAmount: 100, dosageUnit: 'mg',        frequencyType: 'daily',   frequencyInterval: 1,  startDate: monthsAgo(7),  endDate: null,          active: true,  notes: 'For flare-ups after strenuous exercise' },
    { name: 'Cosequin DS',     dosageAmount: 1,   dosageUnit: 'tab',       frequencyType: 'daily',   frequencyInterval: 1,  startDate: monthsAgo(12), endDate: null,          active: true,  notes: 'Joint supplement — glucosamine + chondroitin' },
  ],
];

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const sequelize = new Sequelize({
    dialect: 'postgres',
    host:     process.env.DB_HOST     ?? 'localhost',
    port:     Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME     ?? 'pet_health_tracker',
    username: process.env.DB_USER     ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    logging:  false,
    models: [
      UserModel, GroupModel, GroupMemberModel,
      PetModel, VetModel, VetVisitModel,
      MedicationModel, SymptomModel, HealthCheckModel,
      ReminderModel, ReminderNotifyUserModel,
    ],
  });

  await sequelize.authenticate();
  console.log('Connected to database.');

  // Fixed IDs so the seed is safe to re-run
  const userId  = '00000000-0000-0000-0000-000000000001';
  const groupId = '00000000-0000-0000-0000-000000000002';

  // ── user ──────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('password123', 10);

  const [user] = await UserModel.upsert({
    id:           userId,
    name:         'Alex Johnson',
    email:        'alex@example.com',
    passwordHash: passwordHash,
    createdAt:    yearsAgo(2),
  });
  console.log(`User: ${user.name} (${user.email})  — password: password123`);

  // ── group ─────────────────────────────────────────────────────────────────
  const [group] = await GroupModel.upsert({
    id:        groupId,
    name:      'Johnson Family Pets',
    createdAt: yearsAgo(2),
  });
  console.log(`Group: ${group.name}`);

  await GroupMemberModel.upsert({
    groupId:  groupId,
    userId:   userId,
    role:     'owner',
    joinedAt: yearsAgo(2),
  });

  // ── vets (fixed IDs) ──────────────────────────────────────────────────────
  const vetIds = VETS.map((_, i) => `00000000-0000-0000-0001-${String(i + 1).padStart(12, '0')}`);
  for (let i = 0; i < VETS.length; i++) {
    const v = VETS[i];
    await VetModel.upsert({
      id:        vetIds[i],
      groupId,
      name:      v.name,
      address:   v.address,
      phone:     v.phone,
      workHours: v.workHours,
      createdAt: yearsAgo(2),
    });
  }
  console.log(`Created ${VETS.length} vets.`);

  // ── clear mutable data before re-seeding ─────────────────────────────────
  await MedicationModel.destroy({ where: { } });
  await VetVisitModel.destroy({ where: { } });
  await PetModel.destroy({ where: { } });

  // ── pets + visits + medications ───────────────────────────────────────────
  for (let pi = 0; pi < PETS.length; pi++) {
    const p = PETS[pi];
    const petId = `00000000-0000-0000-0002-${String(pi + 1).padStart(12, '0')}`;

    await PetModel.upsert({
      id:        petId,
      groupId,
      name:      p.name,
      species:   p.species,
      breed:     p.breed,
      birthDate: p.birthDate,
      createdAt: yearsAgo(2),
    });
    console.log(`\nPet: ${p.name} (${p.species} — ${p.breed})`);

    // visits
    const visits = VISIT_TEMPLATES[pi];
    for (let vi = 0; vi < visits.length; vi++) {
      const [dAgo, reason, clinic, notes] = visits[vi];
      const vetId = vetIds[vi % vetIds.length];
      const vet   = VETS[vi % VETS.length];
      const visitDate = daysAgo(dAgo);

      await VetVisitModel.create({
        id:          uuid(),
        petId,
        vetId,
        visitDate,
        clinic,
        vetName:     vet.name,
        reason,
        notes,
        imageUrls:   [],
        nextVisitDate: null,
        createdBy:   userId,
        createdAt:   visitDate,
      });
      console.log(`  Visit [${visitDate.toISOString().slice(0,10)}]: ${reason}`);
    }

    // medications
    const meds = MED_TEMPLATES[pi];
    for (const m of meds) {
      await MedicationModel.create({
        id:                uuid(),
        petId,
        name:              m.name,
        dosageAmount:      m.dosageAmount,
        dosageUnit:        m.dosageUnit,
        frequencyType:     m.frequencyType,
        frequencyInterval: m.frequencyInterval,
        startDate:         m.startDate,
        endDate:           m.endDate,
        notes:             m.notes,
        active:            m.active,
        createdBy:         userId,
        createdAt:         m.startDate,
      });
      console.log(`  Medication: ${m.name} ${m.dosageAmount} ${m.dosageUnit} — every ${m.frequencyInterval} ${m.frequencyType}`);
    }
  }

  console.log('\nSeed complete.');
  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
