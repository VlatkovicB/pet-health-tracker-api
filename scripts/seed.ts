/**
 * Seed script — creates realistic demo data:
 *   1 group, 1 owner user
 *   10 vets
 *   5 pets  (each with 10 past vet visits, 3 medications, 3 symptoms, 3 health checks)
 *   Recent visits include upcoming nextVisitDate to demo the urgency bubble
 *
 * Run:
 *   pnpm ts-node -r dotenv/config --project tsconfig.json scripts/seed.ts
 */

import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { Sequelize } from 'sequelize-typescript';

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
  d.setHours(12, 0, 0, 0);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(12, 0, 0, 0);
  return d;
}

function monthsAgo(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setHours(12, 0, 0, 0);
  return d;
}

function yearsAgo(n: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  d.setHours(12, 0, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// vets
// ---------------------------------------------------------------------------

const VETS = [
  { name: 'Dr. Sarah Mitchell',  address: '14 Oak Street, Springfield',   phone: '555-0101', workHours: 'Mon–Fri 8am–6pm'  },
  { name: 'Dr. James Thornton',  address: '87 Maple Ave, Riverside',       phone: '555-0102', workHours: 'Tue–Sat 9am–5pm'  },
  { name: 'Dr. Elena Vasquez',   address: '230 Pine Road, Lakewood',       phone: '555-0103', workHours: 'Mon–Thu 8am–7pm'  },
  { name: 'Dr. Kevin Park',      address: '5 Birch Lane, Greenfield',      phone: '555-0104', workHours: 'Mon–Fri 9am–6pm'  },
  { name: 'Dr. Patricia Owens',  address: '112 Elm Blvd, Maplewood',      phone: '555-0105', workHours: 'Wed–Sun 10am–6pm' },
  { name: 'Dr. Robert Huang',    address: '78 Cedar Court, Fairview',      phone: '555-0106', workHours: 'Mon–Fri 8am–5pm'  },
  { name: 'Dr. Amanda Foster',   address: '33 Willow Way, Sunnyside',      phone: '555-0107', workHours: 'Tue–Sat 8am–6pm'  },
  { name: 'Dr. Marcus Bell',     address: '9 Aspen Drive, Clearwater',     phone: '555-0108', workHours: 'Mon–Fri 9am–7pm'  },
  { name: 'Dr. Linda Nguyen',    address: '60 Spruce Street, Hillside',    phone: '555-0109', workHours: 'Mon–Sat 9am–5pm'  },
  { name: 'Dr. Thomas Caldwell', address: '200 Redwood Blvd, Forestville', phone: '555-0110', workHours: 'Mon–Fri 8am–6pm'  },
];

// ---------------------------------------------------------------------------
// pets
// ---------------------------------------------------------------------------

const PETS = [
  { name: 'Biscuit',  species: 'Dog', breed: 'Golden Retriever', birthDate: yearsAgo(4) },
  { name: 'Luna',     species: 'Cat', breed: 'Maine Coon',        birthDate: yearsAgo(3) },
  { name: 'Peanut',   species: 'Dog', breed: 'Beagle',            birthDate: yearsAgo(6) },
  { name: 'Whiskers', species: 'Cat', breed: 'Scottish Fold',     birthDate: yearsAgo(2) },
  { name: 'Max',      species: 'Dog', breed: 'German Shepherd',   birthDate: yearsAgo(5) },
];

// ---------------------------------------------------------------------------
// vet visits — [daysAgo, reason, clinic, notes, nextVisitDays | null]
// nextVisitDays > 0 = future appointment (shown in urgency bubble)
// ---------------------------------------------------------------------------

type VisitTemplate = [number, string, string, string, number | null];

const VISIT_TEMPLATES: VisitTemplate[][] = [
  // Biscuit — next visit in 14 days (light green bubble)
  [
    [20,  'Annual wellness exam',         'Paws & Claws Clinic',      'Vaccinations up to date. Weight 32 kg — on target.',                      14  ],
    [55,  'Limping on front left leg',    'Paws & Claws Clinic',      'Minor sprain. Rest for one week. Anti-inflammatories prescribed.',         null],
    [120, 'Skin rash on belly',           'Riverside Animal Hospital', 'Allergic reaction. Antihistamines given. Hypoallergenic diet recommended.', null],
    [180, 'Dental cleaning',              'Paws & Claws Clinic',      'Moderate tartar removed. No extractions needed.',                          null],
    [240, 'Ear infection',                'Greenfield Vet Centre',     'Bacterial otitis. Ear drops for 10 days.',                                null],
    [300, 'Annual wellness exam',         'Paws & Claws Clinic',      'Healthy. Booster shots administered.',                                     null],
    [380, 'Vomiting and lethargy',        'Riverside Animal Hospital', 'Ate something inappropriate. IV fluids overnight. Discharged next day.',   null],
    [450, 'Lump on shoulder',             'Greenfield Vet Centre',     'Benign lipoma. Monitoring only.',                                          null],
    [520, 'Eye discharge',                'Paws & Claws Clinic',      'Mild conjunctivitis. Eye drops twice daily for 7 days.',                   null],
    [600, 'Annual wellness exam',         'Paws & Claws Clinic',      'Good health. Weight slightly elevated — increase exercise.',               null],
  ],
  // Luna — next visit in 7 days (light green bubble)
  [
    [15,  'Annual wellness exam',         'Feline Friends Clinic',    'Healthy. Indoor-only — rabies waived. FeLV negative.',                     7   ],
    [50,  'Not eating for 2 days',        'Feline Friends Clinic',    'Dental pain. One molar extracted. Soft food for 2 weeks.',                 null],
    [100, 'Hairball issues',              'Lakewood Pet Hospital',    'Laxatone recommended. Add fibre to diet.',                                 null],
    [160, 'Upper respiratory infection',  'Feline Friends Clinic',    'Viral URI. Lysine supplement + supportive care.',                          null],
    [220, 'Annual wellness exam',         'Feline Friends Clinic',    'Weight 5.2 kg. All clear.',                                               null],
    [290, 'Limping on hind leg',          'Lakewood Pet Hospital',    'Soft tissue injury. NSAIDs for 5 days. Cage rest.',                        null],
    [360, 'Urinary straining',            'Feline Friends Clinic',    'FIC episode. Increased water intake recommended. Stress reduction.',        null],
    [430, 'Vomiting after eating',        'Lakewood Pet Hospital',    'Food sensitivity. Switch to hydrolyzed protein diet.',                     null],
    [500, 'Annual wellness exam',         'Feline Friends Clinic',    'Healthy. Mild tartar — schedule dental next year.',                        null],
    [580, 'Ear mites',                    'Feline Friends Clinic',    'Topical treatment applied. Recheck in 3 weeks.',                           null],
  ],
  // Peanut — next visit in 21 days (pale green bubble)
  [
    [10,  'Annual wellness exam',         'Beagle Bay Vet',           'Fit and healthy. Bordetella booster given.',                               21  ],
    [45,  'Swallowed a sock',             'Emergency Animal Care',    'Induced vomiting — sock retrieved. Monitoring 24 h. No obstruction.',      null],
    [110, 'Cherry eye',                   'Beagle Bay Vet',           'Surgical correction. Recovery 2 weeks.',                                   null],
    [170, 'Annual wellness exam',         'Beagle Bay Vet',           'Weight 11.5 kg. Good condition.',                                          null],
    [230, 'Tick removal and Lyme test',   'Riverside Animal Hospital', 'Lyme negative. Preventive collar prescribed.',                            null],
    [295, 'Coughing fits',                'Beagle Bay Vet',           'Kennel cough. Antibiotics + rest. No boarding for 3 weeks.',               null],
    [365, 'Annual wellness exam',         'Beagle Bay Vet',           'Healthy. Dental score 2/4 — recommend cleaning.',                         null],
    [425, 'Paw pad cut',                  'Beagle Bay Vet',           'Deep laceration. Sutured. Cone for 10 days.',                              null],
    [490, 'Weight check',                 'Beagle Bay Vet',           'Lost 0.8 kg since last visit. Diet adjusted.',                             null],
    [560, 'Seasonal allergies',           'Riverside Animal Hospital', 'Apoquel prescribed. Review in 6 weeks.',                                  null],
  ],
  // Whiskers — next visit in 2 days (green bubble — urgent)
  [
    [8,   'Recheck eye ulcer',            'City Cat Clinic',          'Corneal ulcer improving. Continue drops for another week. Recheck soon.',   2   ],
    [40,  'Spay surgery',                 'City Cat Clinic',          'Routine spay. No complications. E-collar for 10 days.',                    null],
    [95,  'Sneezing and nasal discharge', 'City Cat Clinic',          'Herpesvirus flare. L-Lysine supplementation started.',                     null],
    [155, 'Annual wellness exam',         'City Cat Clinic',          'Weight 3.8 kg. Growing well. Booster shots done.',                         null],
    [210, 'Diarrhoea for 3 days',         'Maplewood Animal Hospital', 'Giardia. Metronidazole course. Probiotic supplement.',                    null],
    [270, 'Eye ulcer',                    'City Cat Clinic',          'Corneal ulcer right eye. Triple antibiotic ophthalmic drops.',              null],
    [340, 'Overgrooming and bald patches','Maplewood Animal Hospital', 'Stress-induced alopecia. Environmental enrichment plan provided.',         null],
    [400, 'Annual wellness exam',         'City Cat Clinic',          'Healthy. Weight 4.1 kg. Mild gingivitis noted.',                           null],
    [465, 'Vomiting hairballs frequently','City Cat Clinic',          'Diet change to hairball control formula. Regular brushing advised.',        null],
    [530, 'Flea infestation',             'Maplewood Animal Hospital', 'Revolution Plus applied. Treat home environment.',                         null],
  ],
  // Max — next visit in 30 days (grey bubble)
  [
    [12,  'Recheck cruciate ligament',    'Shepherd Specialty Vet',   'Holding stable. Continue physio. Book 1-month follow-up.',                 30  ],
    [60,  'Annual wellness exam',         'Shepherd Specialty Vet',   'Good condition. Core vaccines given.',                                      null],
    [125, 'Degloving injury on tail',     'Emergency Animal Care',    'Surgical repair. Bandage changes every 2 days. Full recovery expected.',    null],
    [185, 'Bloat scare',                  'Emergency Animal Care',    'GDV ruled out. Gas. Walk slowly after meals. Consider gastropexy.',         null],
    [245, 'Annual wellness exam',         'Shepherd Specialty Vet',   'Hip score stable. Weight 34 kg. Good muscle tone.',                        null],
    [310, 'Diarrhoea and blood in stool', 'Shepherd Specialty Vet',   'HGE episode. IV fluids. Bland diet 5 days.',                               null],
    [375, 'Limping on hind right',        'Shepherd Specialty Vet',   'Cruciate ligament partial tear. Physio + NSAIDs. Surgery may be needed.',   null],
    [440, 'Dental cleaning',              'Shepherd Specialty Vet',   'Heavy tartar. Two premolars extracted. Antibiotics 7 days.',                null],
    [510, 'Annual wellness exam',         'Shepherd Specialty Vet',   'Healthy apart from mild arthritis. Carprofen as needed.',                  null],
    [575, 'Hip dysplasia check',          'Shepherd Specialty Vet',   'Mild bilateral HD stable. Joint supplement continued.',                    null],
  ],
];

// ---------------------------------------------------------------------------
// medications
// ---------------------------------------------------------------------------

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
    { name: 'Apoquel',        dosageAmount: 16,  dosageUnit: 'mg',        frequencyType: 'daily',   frequencyInterval: 1, startDate: monthsAgo(4),  endDate: null,          active: true,  notes: 'For seasonal allergies' },
    { name: 'Carprofen',      dosageAmount: 75,  dosageUnit: 'mg',        frequencyType: 'daily',   frequencyInterval: 2, startDate: monthsAgo(18), endDate: monthsAgo(16), active: false, notes: 'Prescribed after sprain' },
    { name: 'Simparica Trio', dosageAmount: 1,   dosageUnit: 'tablet',    frequencyType: 'monthly', frequencyInterval: 1, startDate: monthsAgo(12), endDate: null,          active: true,  notes: 'Flea, tick and heartworm prevention' },
  ],
  // Luna
  [
    { name: 'L-Lysine',       dosageAmount: 500, dosageUnit: 'mg',        frequencyType: 'daily',   frequencyInterval: 2, startDate: monthsAgo(8),  endDate: null,          active: true,  notes: 'Herpesvirus management — add to food' },
    { name: 'Metronidazole',  dosageAmount: 50,  dosageUnit: 'mg',        frequencyType: 'daily',   frequencyInterval: 2, startDate: monthsAgo(14), endDate: monthsAgo(13), active: false, notes: 'Short course for GI upset' },
    { name: 'Revolution Plus',dosageAmount: 1,   dosageUnit: 'pipette',   frequencyType: 'monthly', frequencyInterval: 1, startDate: monthsAgo(6),  endDate: null,          active: true,  notes: 'Topical parasite prevention' },
  ],
  // Peanut
  [
    { name: 'Apoquel',        dosageAmount: 5.4, dosageUnit: 'mg',        frequencyType: 'daily',   frequencyInterval: 1, startDate: monthsAgo(2),  endDate: null,          active: true,  notes: 'Allergy management — reassess in 2 months' },
    { name: 'Doxycycline',    dosageAmount: 100, dosageUnit: 'mg',        frequencyType: 'daily',   frequencyInterval: 2, startDate: monthsAgo(10), endDate: monthsAgo(9),  active: false, notes: 'Kennel cough treatment' },
    { name: 'Seresto collar', dosageAmount: 1,   dosageUnit: 'collar',    frequencyType: 'monthly', frequencyInterval: 8, startDate: monthsAgo(5),  endDate: null,          active: true,  notes: 'Tick prevention' },
  ],
  // Whiskers
  [
    { name: 'L-Lysine',       dosageAmount: 250, dosageUnit: 'mg',        frequencyType: 'daily',   frequencyInterval: 1, startDate: monthsAgo(9),  endDate: null,          active: true,  notes: 'Herpesvirus — mixed into wet food' },
    { name: 'Ofloxacin drops',dosageAmount: 1,   dosageUnit: 'drop',      frequencyType: 'hourly',  frequencyInterval: 8, startDate: daysAgo(8),    endDate: null,          active: true,  notes: 'Eye drops — right eye ulcer' },
    { name: 'Purina Calming', dosageAmount: 1,   dosageUnit: 'tablet',    frequencyType: 'daily',   frequencyInterval: 1, startDate: monthsAgo(5),  endDate: null,          active: true,  notes: 'Stress reduction supplement' },
  ],
  // Max
  [
    { name: 'Librela',        dosageAmount: 1,   dosageUnit: 'injection', frequencyType: 'monthly', frequencyInterval: 1, startDate: monthsAgo(3),  endDate: null,          active: true,  notes: 'Monoclonal antibody — hip arthritis pain' },
    { name: 'Carprofen',      dosageAmount: 100, dosageUnit: 'mg',        frequencyType: 'daily',   frequencyInterval: 1, startDate: monthsAgo(7),  endDate: null,          active: true,  notes: 'For flare-ups after strenuous exercise' },
    { name: 'Cosequin DS',    dosageAmount: 1,   dosageUnit: 'tablet',    frequencyType: 'daily',   frequencyInterval: 1, startDate: monthsAgo(12), endDate: null,          active: true,  notes: 'Joint supplement — glucosamine + chondroitin' },
  ],
];

// ---------------------------------------------------------------------------
// symptoms — [daysAgo, description, severity, notes, resolvedDaysAgo | null]
// ---------------------------------------------------------------------------

type SymptomTemplate = [number, string, 'mild' | 'moderate' | 'severe', string | null, number | null];

const SYMPTOM_TEMPLATES: SymptomTemplate[][] = [
  // Biscuit
  [
    [22,  'Scratching belly and flanks repeatedly',         'mild',     'Noticed after walk in field. Possibly grass allergy.',      20 ],
    [58,  'Holding front left leg up when walking',         'moderate', 'Started after morning run.',                                51 ],
    [3,   'Occasional sneezing, clear discharge',           'mild',     null,                                                       null],
  ],
  // Luna
  [
    [17,  'Sneezing and watery eyes',                       'mild',     'Recurrent — likely herpesvirus flare.',                     12 ],
    [52,  'Not interested in food for 36 hours',            'moderate', 'Eventually ate tuna. Dental discomfort suspected.',         49 ],
    [5,   'Drinking more water than usual',                 'mild',     'Monitoring — could be stress or diet change.',             null],
  ],
  // Peanut
  [
    [12,  'Persistent dry cough after exercise',            'mild',     'No fever. Kennel cough ruled out — likely irritant.',      null],
    [48,  'Bright red eye, pawing at face',                 'moderate', 'Cherry eye visible. Booked for surgery.',                   38 ],
    [2,   'Excessive licking of paws',                      'mild',     'Seasonal pattern — grass allergy likely.',                 null],
  ],
  // Whiskers
  [
    [9,   'Squinting right eye, avoiding light',            'moderate', 'Eye ulcer confirmed on exam.',                             null],
    [35,  'Patches of missing fur on lower back',           'moderate', 'Overgrooming. Stress triggers being investigated.',        null],
    [1,   'Reduced appetite since yesterday',               'mild',     'Still drinking. Monitoring.',                              null],
  ],
  // Max
  [
    [14,  'Skipping steps when climbing stairs',            'moderate', 'Right hind leg weakness. Cruciate related.',               null],
    [62,  'Bloody diarrhoea, two episodes',                 'severe',   'HGE suspected. Rushed to vet. IV fluids given.',            55 ],
    [4,   'Stiffness after lying down for long periods',    'mild',     'Worse in cold weather. Arthritis flare.',                  null],
  ],
];

// ---------------------------------------------------------------------------
// health checks — [daysAgo, weightKg, temperatureC, notes]
// ---------------------------------------------------------------------------

type HealthCheckTemplate = [number, number, number, string];

const HEALTH_CHECK_TEMPLATES: HealthCheckTemplate[][] = [
  // Biscuit
  [
    [20,  32.0, 38.6, 'Annual exam — weight on target. Good coat condition.'],
    [180, 31.4, 38.4, 'Post-dental. Recovering well. Eating soft food.'],
    [365, 30.8, 38.7, 'Annual exam — slightly underweight. Diet increased.'],
  ],
  // Luna
  [
    [15,  5.2,  38.5, 'Annual exam — weight stable. Coat glossy.'],
    [220, 5.0,  38.3, 'Routine check — healthy.'],
    [500, 4.8,  38.6, 'Annual exam — slight weight gain noted. Diet adjusted.'],
  ],
  // Peanut
  [
    [10,  11.5, 38.5, 'Annual exam — good weight. Energy levels normal.'],
    [170, 12.3, 38.8, 'Slightly overweight. Reducing treat intake.'],
    [490, 11.8, 38.4, 'Weight down from last check. Diet change working.'],
  ],
  // Whiskers
  [
    [8,   4.1,  38.9, 'Recheck. Right eye improving. Weight maintained.'],
    [155, 3.8,  38.5, 'Annual exam — growing well.'],
    [400, 4.1,  38.6, 'Annual exam — weight stable. Mild gingivitis noted.'],
  ],
  // Max
  [
    [12,  34.0, 38.7, 'Recheck — weight maintained. Range of motion in hind legs reduced.'],
    [245, 34.2, 38.5, 'Annual exam — good muscle tone. Hip score stable.'],
    [510, 33.8, 38.6, 'Annual exam — mild arthritis. Carprofen as needed.'],
  ],
];

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const sequelize = new Sequelize({
    dialect:  'postgres',
    host:     process.env.DB_HOST     ?? 'localhost',
    port:     Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME     ?? 'pet_health_tracker',
    username: process.env.DB_USER     ?? 'latzko',
    password: process.env.DB_PASSWORD ?? '',
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

  // ── full truncate ─────────────────────────────────────────────────────────
  console.log('Truncating all tables…');
  await sequelize.query(`
    TRUNCATE TABLE
      reminder_notify_users, reminders,
      health_checks, symptoms,
      medications, vet_visits,
      pets, vets,
      group_members, groups, users
    RESTART IDENTITY CASCADE
  `);

  // ── fixed IDs (safe to re-run) ────────────────────────────────────────────
  const userId  = '00000000-0000-0000-0000-000000000001';
  const groupId = '00000000-0000-0000-0000-000000000002';

  // ── user ──────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('password123', 10);
  await UserModel.create({
    id:           userId,
    name:         'Alex Johnson',
    email:        'alex@example.com',
    passwordHash,
    createdAt:    yearsAgo(2),
  });
  console.log('User: Alex Johnson (alex@example.com) — password: password123');

  // ── group ─────────────────────────────────────────────────────────────────
  await GroupModel.create({ id: groupId, name: 'Johnson Family Pets', createdAt: yearsAgo(2) });
  await GroupMemberModel.create({ groupId, userId, role: 'owner', joinedAt: yearsAgo(2) });
  console.log('Group: Johnson Family Pets');

  // ── vets ──────────────────────────────────────────────────────────────────
  const vetIds = VETS.map((_, i) => `00000000-0000-0000-0001-${String(i + 1).padStart(12, '0')}`);
  for (let i = 0; i < VETS.length; i++) {
    await VetModel.create({ id: vetIds[i], groupId, ...VETS[i], createdAt: yearsAgo(2) });
  }
  console.log(`Created ${VETS.length} vets.`);

  // ── pets + visits + medications + symptoms + health checks ────────────────
  for (let pi = 0; pi < PETS.length; pi++) {
    const p = PETS[pi];
    const petId = `00000000-0000-0000-0002-${String(pi + 1).padStart(12, '0')}`;

    await PetModel.create({ id: petId, groupId, ...p, createdAt: yearsAgo(2) });
    console.log(`\nPet: ${p.name} (${p.species} — ${p.breed})`);

    // visits
    for (let vi = 0; vi < VISIT_TEMPLATES[pi].length; vi++) {
      const [dAgo, reason, clinic, notes, nextVisitDays] = VISIT_TEMPLATES[pi][vi];
      const vetId     = vetIds[vi % vetIds.length];
      const vet       = VETS[vi % VETS.length];
      const visitDate = daysAgo(dAgo);

      await VetVisitModel.create({
        id:            uuid(),
        petId,
        vetId,
        visitDate,
        clinic,
        vetName:       vet.name,
        reason,
        notes,
        imageUrls:     [],
        nextVisitDate: nextVisitDays !== null ? daysFromNow(nextVisitDays) : null,
        createdBy:     userId,
        createdAt:     visitDate,
      });
      const nextTag = nextVisitDays !== null ? ` → next in ${nextVisitDays}d` : '';
      console.log(`  Visit [${visitDate.toISOString().slice(0, 10)}]: ${reason}${nextTag}`);
    }

    // medications
    for (const m of MED_TEMPLATES[pi]) {
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
      console.log(`  Med: ${m.name} ${m.dosageAmount} ${m.dosageUnit} (${m.frequencyInterval}× ${m.frequencyType})`);
    }

    // symptoms
    for (const [dAgo, description, severity, notes, resolvedDaysAgo] of SYMPTOM_TEMPLATES[pi]) {
      const observedAt = daysAgo(dAgo);
      await SymptomModel.create({
        id:          uuid(),
        petId,
        description,
        severity,
        observedAt,
        notes:       notes ?? null,
        resolvedAt:  resolvedDaysAgo !== null ? daysAgo(resolvedDaysAgo) : null,
        createdBy:   userId,
        createdAt:   observedAt,
      });
      console.log(`  Symptom [${observedAt.toISOString().slice(0, 10)}]: ${description} (${severity})`);
    }

    // health checks
    for (const [dAgo, weightKg, temperatureC, notes] of HEALTH_CHECK_TEMPLATES[pi]) {
      const checkedAt = daysAgo(dAgo);
      await HealthCheckModel.create({
        id:           uuid(),
        petId,
        weightKg,
        temperatureC,
        notes,
        checkedAt,
        createdBy:    userId,
        createdAt:    checkedAt,
      });
      console.log(`  HealthCheck [${checkedAt.toISOString().slice(0, 10)}]: ${weightKg} kg / ${temperatureC}°C`);
    }
  }

  console.log('\nSeed complete.');
  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
