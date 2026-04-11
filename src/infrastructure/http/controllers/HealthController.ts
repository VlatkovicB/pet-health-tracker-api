import { Request, Response, NextFunction } from 'express';
import { Service } from 'typedi';
import { AddVetVisitUseCase } from '../../../application/health/AddVetVisitUseCase';
import { AddVetVisitImageUseCase } from '../../../application/health/AddVetVisitImageUseCase';
import { UpdateVetVisitUseCase } from '../../../application/health/UpdateVetVisitUseCase';
import { ListVetVisitsUseCase } from '../../../application/health/ListVetVisitsUseCase';
import { LogMedicationUseCase } from '../../../application/health/LogMedicationUseCase';
import { UpdateMedicationUseCase } from '../../../application/health/UpdateMedicationUseCase';
import { ListMedicationsUseCase } from '../../../application/health/ListMedicationsUseCase';
import { RecordSymptomUseCase } from '../../../application/health/RecordSymptomUseCase';
import { ListSymptomsUseCase } from '../../../application/health/ListSymptomsUseCase';
import { AddHealthCheckUseCase } from '../../../application/health/AddHealthCheckUseCase';
import { ListHealthChecksUseCase } from '../../../application/health/ListHealthChecksUseCase';
import { VetVisitMapper } from '../../mappers/VetVisitMapper';
import { MedicationMapper } from '../../mappers/MedicationMapper';
import { SymptomMapper } from '../../mappers/SymptomMapper';
import { HealthCheckMapper } from '../../mappers/HealthCheckMapper';

@Service()
export class HealthController {
  constructor(
    private readonly addVetVisit: AddVetVisitUseCase,
    private readonly addVetVisitImage: AddVetVisitImageUseCase,
    private readonly updateVetVisit: UpdateVetVisitUseCase,
    private readonly listVetVisits: ListVetVisitsUseCase,
    private readonly logMedication: LogMedicationUseCase,
    private readonly updateMedication: UpdateMedicationUseCase,
    private readonly listMedications: ListMedicationsUseCase,
    private readonly recordSymptom: RecordSymptomUseCase,
    private readonly listSymptoms: ListSymptomsUseCase,
    private readonly addHealthCheck: AddHealthCheckUseCase,
    private readonly listHealthChecks: ListHealthChecksUseCase,
    private readonly vetVisitMapper: VetVisitMapper,
    private readonly medicationMapper: MedicationMapper,
    private readonly symptomMapper: SymptomMapper,
    private readonly healthCheckMapper: HealthCheckMapper,
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
      const visit = await this.addVetVisit.execute({
        ...req.body,
        petId: req.params.petId,
        visitDate: new Date(req.body.visitDate),
        nextVisitDate: req.body.nextVisitDate ? new Date(req.body.nextVisitDate) : undefined,
        requestingUserId: req.auth.userId,
      });
      res.status(201).json(this.vetVisitMapper.toResponse(visit));
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
        nextVisitDate: req.body.nextVisitDate === null
          ? null
          : req.body.nextVisitDate ? new Date(req.body.nextVisitDate) : undefined,
        requestingUserId: req.auth.userId,
      });
      res.json(this.vetVisitMapper.toResponse(visit));
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

  getSymptoms = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const result = await this.listSymptoms.execute(req.params.petId, req.auth.userId, { page, limit });
      res.json({ ...result, items: result.items.map((s) => this.symptomMapper.toResponse(s)) });
    } catch (err) {
      next(err);
    }
  };

  createSymptom = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const symptom = await this.recordSymptom.execute({
        ...req.body,
        petId: req.params.petId,
        observedAt: new Date(req.body.observedAt),
        requestingUserId: req.auth.userId,
      });
      res.status(201).json(this.symptomMapper.toResponse(symptom));
    } catch (err) {
      next(err);
    }
  };

  getHealthChecks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const result = await this.listHealthChecks.execute(req.params.petId, req.auth.userId, { page, limit });
      res.json({ ...result, items: result.items.map((c) => this.healthCheckMapper.toResponse(c)) });
    } catch (err) {
      next(err);
    }
  };

  createHealthCheck = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const check = await this.addHealthCheck.execute({
        ...req.body,
        petId: req.params.petId,
        checkedAt: new Date(req.body.checkedAt),
        requestingUserId: req.auth.userId,
      });
      res.status(201).json(this.healthCheckMapper.toResponse(check));
    } catch (err) {
      next(err);
    }
  };
}
