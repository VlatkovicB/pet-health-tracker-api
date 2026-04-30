import { JsonController, Get, Post, Put, Delete, Body, Param, UseBefore, CurrentUser, HttpCode, OnUndefined } from 'routing-controllers';
import { Service } from 'typedi';
import { AddWeightEntryUseCase } from '../../../application/weight/AddWeightEntryUseCase';
import { ListWeightEntriesUseCase } from '../../../application/weight/ListWeightEntriesUseCase';
import { UpdateWeightEntryUseCase } from '../../../application/weight/UpdateWeightEntryUseCase';
import { DeleteWeightEntryUseCase } from '../../../application/weight/DeleteWeightEntryUseCase';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';
import { Validate } from '../decorators/Validate';
import { AddWeightEntrySchema, AddWeightEntryBody, UpdateWeightEntrySchema, UpdateWeightEntryBody } from '../schemas/weightSchemas';

@JsonController('/pets')
@Service()
@UseBefore(authMiddleware)
export class WeightController {
  constructor(
    private readonly addEntry: AddWeightEntryUseCase,
    private readonly listEntries: ListWeightEntriesUseCase,
    private readonly updateEntry: UpdateWeightEntryUseCase,
    private readonly deleteEntry: DeleteWeightEntryUseCase,
  ) {}

  @Post('/:petId/weight')
  @HttpCode(201)
  @Validate({ body: AddWeightEntrySchema })
  async create(@Param('petId') petId: string, @Body() body: AddWeightEntryBody, @CurrentUser() user: AuthPayload) {
    return this.addEntry.execute({ userId: user.userId, petId, ...body });
  }

  @Get('/:petId/weight')
  async list(@Param('petId') petId: string, @CurrentUser() user: AuthPayload) {
    return this.listEntries.execute({ userId: user.userId, petId });
  }

  @Put('/:petId/weight/:entryId')
  @Validate({ body: UpdateWeightEntrySchema })
  async update(@Param('petId') petId: string, @Param('entryId') entryId: string, @Body() body: UpdateWeightEntryBody, @CurrentUser() user: AuthPayload) {
    return this.updateEntry.execute({ userId: user.userId, petId, entryId, ...body });
  }

  @Delete('/:petId/weight/:entryId')
  @OnUndefined(204)
  async delete(@Param('petId') petId: string, @Param('entryId') entryId: string, @CurrentUser() user: AuthPayload) {
    await this.deleteEntry.execute({ userId: user.userId, petId, entryId });
  }
}
