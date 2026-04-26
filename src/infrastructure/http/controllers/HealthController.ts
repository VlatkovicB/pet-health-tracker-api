import { JsonController, Get, Post, Put, Patch, Body, Param, QueryParams, UseBefore, CurrentUser, HttpCode, OnUndefined, Req } from 'routing-controllers';
import { Request } from 'express';
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
import { ReminderRepository, REMINDER_REPOSITORY } from '../../../domain/reminder/ReminderRepository';
import { VetVisitMapper } from '../../mappers/VetVisitMapper';
import { MedicationMapper } from '../../mappers/MedicationMapper';
import { ReminderMapper } from '../../mappers/ReminderMapper';
import { NotFoundError, AppError } from '../../../shared/errors/AppError';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';
import { uploadImage } from '../middleware/upload';
import { Validate } from '../decorators/Validate';
import {
  CreateVetVisitSchema, CreateVetVisitBody,
  UpdateVetVisitSchema, UpdateVetVisitBody,
  CompleteVetVisitSchema, CompleteVetVisitBody,
  CreateMedicationSchema, CreateMedicationBody,
  UpdateMedicationSchema, UpdateMedicationBody,
} from '../schemas/healthSchemas';
import { ConfigureVetVisitReminderSchema, ConfigureVetVisitReminderBody } from '../schemas/reminderSchemas';
import { PaginationQuerySchema, PaginationQuery } from '../schemas/petSchemas';

@JsonController('/pets')
@Service()
@UseBefore(authMiddleware)
export class HealthController {
  constructor(
    private readonly addVetVisitUseCase: AddVetVisitUseCase,
    private readonly addVetVisitImageUseCase: AddVetVisitImageUseCase,
    private readonly updateVetVisitUseCase: UpdateVetVisitUseCase,
    private readonly completeVetVisitUseCase: CompleteVetVisitUseCase,
    private readonly listVetVisitsUseCase: ListVetVisitsUseCase,
    private readonly logMedicationUseCase: LogMedicationUseCase,
    private readonly updateMedicationUseCase: UpdateMedicationUseCase,
    private readonly listMedicationsUseCase: ListMedicationsUseCase,
    private readonly configureVetVisitReminderUseCase: ConfigureVetVisitReminderUseCase,
    private readonly vetVisitMapper: VetVisitMapper,
    private readonly medicationMapper: MedicationMapper,
    private readonly reminderMapper: ReminderMapper,
    @Inject(REMINDER_REPOSITORY) private readonly reminderRepo: ReminderRepository,
  ) {}

  @Get('/:petId/vet-visits')
  @Validate({ query: PaginationQuerySchema })
  async getVetVisits(@Param('petId') petId: string, @QueryParams() query: PaginationQuery, @CurrentUser() user: AuthPayload) {
    const result = await this.listVetVisitsUseCase.execute(petId, user.userId, query);
    return { ...result, items: result.items.map(v => this.vetVisitMapper.toResponse(v)) };
  }

  @Post('/:petId/vet-visits')
  @HttpCode(201)
  @Validate({ body: CreateVetVisitSchema })
  async createVetVisit(@Param('petId') petId: string, @Body() body: CreateVetVisitBody, @CurrentUser() user: AuthPayload) {
    const result = await this.addVetVisitUseCase.execute({ ...body, petId, requestingUserId: user.userId });
    return {
      visit: this.vetVisitMapper.toResponse(result.visit),
      nextVisit: result.nextVisit ? this.vetVisitMapper.toResponse(result.nextVisit) : undefined,
    };
  }

  @Put('/:petId/vet-visits/:visitId')
  @Validate({ body: UpdateVetVisitSchema })
  async updateVetVisit(@Param('visitId') visitId: string, @Body() body: UpdateVetVisitBody, @CurrentUser() user: AuthPayload) {
    const visit = await this.updateVetVisitUseCase.execute({ visitId, ...body, requestingUserId: user.userId });
    return this.vetVisitMapper.toResponse(visit);
  }

  @Patch('/:petId/vet-visits/:visitId/complete')
  @Validate({ body: CompleteVetVisitSchema })
  async completeVetVisit(@Param('visitId') visitId: string, @Body() body: CompleteVetVisitBody, @CurrentUser() user: AuthPayload) {
    const visit = await this.completeVetVisitUseCase.execute({ visitId, ...body, requestingUserId: user.userId });
    return this.vetVisitMapper.toResponse(visit);
  }

  @Get('/:petId/vet-visits/:visitId/reminder')
  async getVetVisitReminder(@Param('visitId') visitId: string) {
    const reminder = await this.reminderRepo.findByEntityId(visitId);
    if (!reminder) throw new NotFoundError('Reminder');
    return this.reminderMapper.toResponse(reminder);
  }

  @Put('/:petId/vet-visits/:visitId/reminder')
  @OnUndefined(204)
  @Validate({ body: ConfigureVetVisitReminderSchema })
  async configureVetVisitReminder(@Param('visitId') visitId: string, @Body() body: ConfigureVetVisitReminderBody, @CurrentUser() user: AuthPayload) {
    await this.configureVetVisitReminderUseCase.execute({ visitId, ...body, requestingUserId: user.userId });
  }

  @Post('/:petId/vet-visits/:visitId/images')
  @UseBefore(uploadImage.single('image'))
  async uploadVetVisitImage(@Param('visitId') visitId: string, @Req() req: Request, @CurrentUser() user: AuthPayload) {
    if (!req.file) throw new AppError('No file uploaded', 400);
    const imageUrl = `/uploads/vet-visits/${req.file.filename}`;
    const visit = await this.addVetVisitImageUseCase.execute(visitId, imageUrl, user.userId);
    return this.vetVisitMapper.toResponse(visit);
  }

  @Get('/:petId/medications')
  async getMedications(@Param('petId') petId: string, @CurrentUser() user: AuthPayload) {
    const summaries = await this.listMedicationsUseCase.execute(petId, user.userId);
    return summaries.map(s => this.medicationMapper.toResponse(s.medication, s.reminderEnabled, s.advanceNotice));
  }

  @Post('/:petId/medications')
  @HttpCode(201)
  @Validate({ body: CreateMedicationSchema })
  async createMedication(@Param('petId') petId: string, @Body() body: CreateMedicationBody, @CurrentUser() user: AuthPayload) {
    const medication = await this.logMedicationUseCase.execute({ petId, ...body, requestingUserId: user.userId });
    return this.medicationMapper.toResponse(medication, body.reminder?.enabled ?? false, body.reminder?.advanceNotice);
  }

  @Put('/:petId/medications/:medicationId')
  @Validate({ body: UpdateMedicationSchema })
  async updateMedication(@Param('medicationId') medicationId: string, @Body() body: UpdateMedicationBody, @CurrentUser() user: AuthPayload) {
    const medication = await this.updateMedicationUseCase.execute({ medicationId, ...body, requestingUserId: user.userId });
    return this.medicationMapper.toResponse(medication, body.reminder?.enabled ?? false, body.reminder?.advanceNotice);
  }
}
