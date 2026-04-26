import { JsonController, Post, Delete, Body, Param, UseBefore, CurrentUser, HttpCode, OnUndefined } from 'routing-controllers';
import { Service } from 'typedi';
import { InitiateOwnershipTransferUseCase } from '../../../application/transfer/InitiateOwnershipTransferUseCase';
import { CancelOwnershipTransferUseCase } from '../../../application/transfer/CancelOwnershipTransferUseCase';
import { PetOwnershipTransferMapper } from '../../mappers/PetOwnershipTransferMapper';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';
import { Validate } from '../decorators/Validate';
import { InitiateTransferSchema, InitiateTransferBody } from '../schemas/transferSchemas';

@JsonController('/pets')
@Service()
@UseBefore(authMiddleware)
export class TransferController {
  constructor(
    private readonly initiateTransfer: InitiateOwnershipTransferUseCase,
    private readonly cancelTransfer: CancelOwnershipTransferUseCase,
    private readonly mapper: PetOwnershipTransferMapper,
  ) {}

  @Post('/:petId/transfer')
  @HttpCode(201)
  @Validate({ body: InitiateTransferSchema })
  async initiate(@Param('petId') petId: string, @Body() body: InitiateTransferBody, @CurrentUser() user: AuthPayload) {
    const transfer = await this.initiateTransfer.execute(petId, user.userId, body.email);
    return this.mapper.toResponse(transfer);
  }

  @Delete('/:petId/transfer')
  @OnUndefined(204)
  async cancel(@Param('petId') petId: string, @CurrentUser() user: AuthPayload) {
    await this.cancelTransfer.execute(petId, user.userId);
  }
}
