import { JsonController, Get, Patch, Param, UseBefore, CurrentUser, OnUndefined } from 'routing-controllers';
import { Service } from 'typedi';
import { ListPendingSharesUseCase } from '../../../application/share/ListPendingSharesUseCase';
import { AcceptShareUseCase } from '../../../application/share/AcceptShareUseCase';
import { DeclineShareUseCase } from '../../../application/share/DeclineShareUseCase';
import { PetShareMapper } from '../../mappers/PetShareMapper';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';

@JsonController('/pet-shares')
@Service()
@UseBefore(authMiddleware)
export class PetShareInboxController {
  constructor(
    private readonly listPendingShares: ListPendingSharesUseCase,
    private readonly acceptShare: AcceptShareUseCase,
    private readonly declineShare: DeclineShareUseCase,
    private readonly shareMapper: PetShareMapper,
  ) {}

  @Get('/pending')
  async listPending(@CurrentUser() user: AuthPayload) {
    const shares = await this.listPendingShares.execute(user.userId);
    return shares.map(s => this.shareMapper.toResponse(s));
  }

  @Patch('/:shareId/accept')
  @OnUndefined(204)
  async accept(@Param('shareId') shareId: string, @CurrentUser() user: AuthPayload) {
    await this.acceptShare.execute(shareId, user.userId);
  }

  @Patch('/:shareId/decline')
  @OnUndefined(204)
  async decline(@Param('shareId') shareId: string, @CurrentUser() user: AuthPayload) {
    await this.declineShare.execute(shareId, user.userId);
  }
}
