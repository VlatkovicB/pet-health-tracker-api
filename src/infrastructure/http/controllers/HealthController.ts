import { Request, Response, NextFunction } from 'express';
import { Inject, Service } from 'typedi';
import { AddVetVisitUseCase } from '../../../application/health/AddVetVisitUseCase';
import { AddVetVisitImageUseCase } from '../../../application/health/AddVetVisitImageUseCase';
import { UpdateVetVisitUseCase } from '../../../application/health/UpdateVetVisitUseCase';
import { CompleteVetVisitUseCase } from '../../../application/health/CompleteVetVisitUseCase';
import { ListVetVisitsUseCase } from '../../../application/health/ListVetVisitsUseCase';
import { LogMedicationUseCase } from '../../../application/health/LogMedicationUseCase';
import { UpdateMedicationUseCase } from '../../../application/health/UpdateMedicationUseCase';
import { ListMedicationsUseCase } from '../../../application/health/ListMedicationsUseCase';
import { ConfigureVetVisitReminderUseCase } from '../../../application/reminder/ConfigureVetVisitReminderUseCase';
import { VetVisitMapper } from '../../mappers/VetVisitMapper';
import { MedicationMapper } from '../../mappers/MedicationMapper';
import { ReminderMapper } from '../../mappers/ReminderMapper';
import { HealthRecordRepository, HEALTH_RECORD_REPOSITORY } from '../../../domain/health/HealthRecordRepository';
import { ReminderRepository, REMINDER_REPOSITORY } from '../../../domain/reminder/ReminderRepository';

@Service()
export class HealthController {
  constructor(
    private readonly addVetVisit: AddVetVisitUseCase,
    private readonly addVetVisitImage: AddVetVisitImageUseCase,
    private readonly updateVetVisit: UpdateVetVisitUseCase,
    private readonly completeVetVisitUseCase: CompleteVetVisitUseCase,
    private readonly listVetVisits: ListVetVisitsUseCase,
    private readonly logMedication: LogMedicationUseCase,
    private readonly updateMedication: UpdateMedicationUseCase,
    private readonly listMedications: ListMedicationsUseCase,
    private readonly configureVetVisitReminder: ConfigureVetVisitReminderUseCase,
    private readonly vetVisitMapper: VetVisitMapper,
    private readonly medicationMapper: MedicationMapper,
    private readonly reminderMapper: ReminderMapper,
    @Inject(HEALTH_RECORD_REPOSITORY) private readonly healthRepo: HealthRecordRepository,
    @Inject(REMINDER_REPOSITORY) private readonly reminderRepo: ReminderRepository,
  ) {}

  getVetVisits = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const result = await this.listVetVisits.execute(req.params.petId, req.auth.userId, { page, limit });
      res.json({ ...result, items: result.items.map((v) => this.vetVisitMapper.toResponse(v)) });
    } catch (err) {
      next(err);
    }
  };

  createVetVisit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scheduleNextVisit = req.body.scheduleNextVisit
        ? { ...req.body.scheduleNextVisit, visitDate: new Date(req.body.scheduleNextVisit.visitDate) }
        : undefined;

      const result = await this.addVetVisit.execute({
        ...req.body,
        petId: req.params.petId,
        visitDate: new Date(req.body.visitDate),
        scheduleNextVisit,
        requestingUserId: req.auth.userId,
      });

      res.status(201).json({
        visit: this.vetVisitMapper.toResponse(result.visit),
        nextVisit: result.nextVisit ? this.vetVisitMapper.toResponse(result.nextVisit) : undefined,
      });
    } catch (err) {
      next(err);
    }
  };

  uploadVetVisitImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) { res.status(400).json({ message: 'No file uploaded' }); return; }
      const imageUrl = `/uploads/vet-visits/${req.file.filename}`;
      const visit = await this.addVetVisitImage.execute(req.params.visitId, imageUrl, req.auth.userId);
      res.json(this.vetVisitMapper.toResponse(visit));
    } catch (err) {
      next(err);
    }
  };

  updateVetVisitHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const visit = await this.updateVetVisit.execute({
        visitId: req.params.visitId,
        vetId: req.body.vetId,
        reason: req.body.reason,
        notes: req.body.notes,
        visitDate: req.body.visitDate ? new Date(req.body.visitDate) : undefined,
        requestingUserId: req.auth.userId,
      });
      res.json(this.vetVisitMapper.toResponse(visit));
    } catch (err) {
      next(err);
    }
  };

  completeVetVisit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const visit = await this.completeVetVisitUseCase.execute({
        visitId: req.params.visitId,
        notes: req.body.notes,
        requestingUserId: req.auth.userId,
      });
      res.json(this.vetVisitMapper.toResponse(visit));
    } catch (err) {
      next(err);
    }
  };

  getVetVisitReminder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const reminder = await this.reminderRepo.findByEntityId(req.params.visitId);
      if (!reminder) { res.status(404).json({ message: 'No reminder configured' }); return; }
      res.json(this.reminderMapper.toResponse(reminder));
    } catch (err) {
      next(err);
    }
  };

  configureVetVisitReminderHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.configureVetVisitReminder.execute({
        visitId: req.params.visitId,
        schedule: req.body.schedule,
        enabled: req.body.enabled,
        requestingUserId: req.auth.userId,
      });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  getUpcomingVetVisits = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const visits = await this.healthRepo.findUpcomingVetVisitsByUserId(req.auth.userId);
      res.json(visits.map((v) => this.vetVisitMapper.toResponse(v)));
    } catch (err) {
      next(err);
    }
  };

  getMedications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const medications = await this.listMedications.execute(req.params.petId, req.auth.userId);
      res.json(medications.map((m) => this.medicationMapper.toResponse(m)));
    } catch (err) {
      next(err);
    }
  };

  createMedication = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const medication = await this.logMedication.execute({
        petId: req.params.petId,
        name: req.body.name,
        dosageAmount: req.body.dosageAmount,
        dosageUnit: req.body.dosageUnit,
        frequency: req.body.frequency,
        startDate: new Date(req.body.startDate),
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
        notes: req.body.notes,
        requestingUserId: req.auth.userId,
      });
      res.status(201).json(this.medicationMapper.toResponse(medication));
    } catch (err) {
      next(err);
    }
  };

  updateMedicationHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const medication = await this.updateMedication.execute({
        medicationId: req.params.medicationId,
        name: req.body.name,
        dosageAmount: req.body.dosageAmount,
        dosageUnit: req.body.dosageUnit,
        frequency: req.body.frequency,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate === null ? null : req.body.endDate ? new Date(req.body.endDate) : undefined,
        notes: req.body.notes !== undefined ? (req.body.notes || null) : undefined,
        active: req.body.active,
        requestingUserId: req.auth.userId,
      });
      res.json(this.medicationMapper.toResponse(medication));
    } catch (err) {
      next(err);
    }
  };
}
