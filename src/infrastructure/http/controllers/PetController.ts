import { JsonController, Get, Post, Put, Body, Param, QueryParams, UseBefore, CurrentUser, HttpCode, Req } from 'routing-controllers';
import { Request } from 'express';
import { Service } from 'typedi';
import { AddPetUseCase } from '../../../application/pet/AddPetUseCase';
import { ListPetsUseCase } from '../../../application/pet/ListPetsUseCase';
import { GetPetUseCase } from '../../../application/pet/GetPetUseCase';
import { UpdatePetUseCase } from '../../../application/pet/UpdatePetUseCase';
import { PetMapper } from '../../mappers/PetMapper';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';
import { uploadPetPhoto } from '../middleware/upload';
import { AppError } from '../../../shared/errors/AppError';
import { Validate } from '../decorators/Validate';
import {
  CreatePetSchema, CreatePetBody,
  UpdatePetSchema, UpdatePetBody,
  PaginationQuerySchema, PaginationQuery,
} from '../schemas/petSchemas';

@JsonController('/pets')
@Service()
@UseBefore(authMiddleware)
export class PetController {
  constructor(
    private readonly addPet: AddPetUseCase,
    private readonly listPets: ListPetsUseCase,
    private readonly getPet: GetPetUseCase,
    private readonly updatePet: UpdatePetUseCase,
    private readonly mapper: PetMapper,
  ) {}

  @Get('/')
  @Validate({ query: PaginationQuerySchema })
  async list(@QueryParams() query: PaginationQuery, @CurrentUser() user: AuthPayload) {
    const result = await this.listPets.execute(user.userId, query);
    return { ...result, items: result.items.map(p => this.mapper.toResponse(p)) };
  }

  @Post('/')
  @HttpCode(201)
  @Validate({ body: CreatePetSchema })
  async create(@Body() body: CreatePetBody, @CurrentUser() user: AuthPayload) {
    const pet = await this.addPet.execute({
      ...body,
      requestingUserId: user.userId,
    });
    return this.mapper.toResponse(pet);
  }

  @Get('/:petId')
  async get(@Param('petId') petId: string, @CurrentUser() user: AuthPayload) {
    const pet = await this.getPet.execute(petId, user.userId);
    return this.mapper.toResponse(pet);
  }

  @Put('/:petId')
  @Validate({ body: UpdatePetSchema })
  async update(@Param('petId') petId: string, @Body() body: UpdatePetBody, @CurrentUser() user: AuthPayload) {
    const pet = await this.updatePet.execute({
      petId,
      ...body,
      requestingUserId: user.userId,
    });
    return this.mapper.toResponse(pet);
  }

  @Post('/:petId/photo')
  @UseBefore(uploadPetPhoto.single('photo'))
  async uploadPhoto(@Param('petId') petId: string, @Req() req: Request, @CurrentUser() user: AuthPayload) {
    if (!req.file) throw new AppError('No file uploaded', 400);
    const photoUrl = `/uploads/pets/${req.file.filename}`;
    const pet = await this.updatePet.execute({ petId, photoUrl, requestingUserId: user.userId });
    return this.mapper.toResponse(pet);
  }
}
