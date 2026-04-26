import { JsonController, Get, Patch, Body, Param, UseBefore, CurrentUser, OnUndefined } from 'routing-controllers';
import { Service } from 'typedi';
import { ListPendingTransfersUseCase } from '../../../application/transfer/ListPendingTransfersUseCase';
import { AcceptOwnershipTransferUseCase } from '../../../application/transfer/AcceptOwnershipTransferUseCase';
import { DeclineOwnershipTransferUseCase } from '../../../application/transfer/DeclineOwnershipTransferUseCase';
import { PetOwnershipTransferMapper } from '../../mappers/PetOwnershipTransferMapper';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';
import { Validate } from '../decorators/Validate';
import { AcceptTransferSchema, AcceptTransferBody } from '../schemas/transferSchemas';

@JsonController('/pet-ownership-transfers')
@Service()
@UseBefore(authMiddleware)
export class PetTransferInboxController {
  constructor(
    private readonly listPendingTransfers: ListPendingTransfersUseCase,
    private readonly acceptTransfer: AcceptOwnershipTransferUseCase,
    private readonly declineTransfer: DeclineOwnershipTransferUseCase,
    private readonly mapper: PetOwnershipTransferMapper,
  ) {}

  @Get('/pending')
  async listPending(@CurrentUser() user: AuthPayload) {
    const transfers = await this.listPendingTransfers.execute(user.userId);
    return transfers.map(t => this.mapper.toResponse(t));
  }

  @Patch('/:transferId/accept')
  @OnUndefined(204)
  @Validate({ body: AcceptTransferSchema })
  async accept(@Param('transferId') transferId: string, @Body() body: AcceptTransferBody, @CurrentUser() user: AuthPayload) {
    await this.acceptTransfer.execute(transferId, user.userId, body.retainAccessForOriginalOwner === true);
  }

  @Patch('/:transferId/decline')
  @OnUndefined(204)
  async decline(@Param('transferId') transferId: string, @CurrentUser() user: AuthPayload) {
    await this.declineTransfer.execute(transferId, user.userId);
  }
}
