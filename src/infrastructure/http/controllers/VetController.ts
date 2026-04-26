import { JsonController, Get, Post, Put, Body, Param, QueryParams, UseBefore, CurrentUser, HttpCode } from 'routing-controllers';
import { Service } from 'typedi';
import { CreateVetUseCase } from '../../../application/vet/CreateVetUseCase';
import { ListVetsUseCase } from '../../../application/vet/ListVetsUseCase';
import { UpdateVetUseCase } from '../../../application/vet/UpdateVetUseCase';
import { VetMapper } from '../../mappers/VetMapper';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';
import { Validate } from '../decorators/Validate';
import { CreateVetSchema, CreateVetBody, UpdateVetSchema, UpdateVetBody } from '../schemas/vetSchemas';
import { PaginationQuerySchema, PaginationQuery } from '../schemas/petSchemas';

@JsonController('/vets')
@Service()
@UseBefore(authMiddleware)
export class VetController {
  constructor(
    private readonly createVet: CreateVetUseCase,
    private readonly listVets: ListVetsUseCase,
    private readonly updateVet: UpdateVetUseCase,
    private readonly mapper: VetMapper,
  ) {}

  @Get('/')
  @Validate({ query: PaginationQuerySchema })
  async list(@QueryParams() query: PaginationQuery, @CurrentUser() user: AuthPayload) {
    const result = await this.listVets.execute(user.userId, query);
    return { ...result, items: result.items.map(v => this.mapper.toResponse(v)) };
  }

  @Post('/')
  @HttpCode(201)
  @Validate({ body: CreateVetSchema })
  async create(@Body() body: CreateVetBody, @CurrentUser() user: AuthPayload) {
    const vet = await this.createVet.execute({ ...body, requestingUserId: user.userId });
    return this.mapper.toResponse(vet);
  }

  @Put('/:id')
  @Validate({ body: UpdateVetSchema })
  async update(@Param('id') id: string, @Body() body: UpdateVetBody, @CurrentUser() user: AuthPayload) {
    const vet = await this.updateVet.execute({ vetId: id, ...body, requestingUserId: user.userId });
    return this.mapper.toResponse(vet);
  }
}
