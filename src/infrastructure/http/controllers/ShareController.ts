import { JsonController, Get, Post, Put, Delete, Body, Param, UseBefore, CurrentUser, HttpCode, OnUndefined } from 'routing-controllers';
import { Service } from 'typedi';
import { SharePetUseCase } from '../../../application/share/SharePetUseCase';
import { UpdateSharePermissionsUseCase } from '../../../application/share/UpdateSharePermissionsUseCase';
import { RevokeShareUseCase } from '../../../application/share/RevokeShareUseCase';
import { ListPetSharesUseCase } from '../../../application/share/ListPetSharesUseCase';
import { ListSharedPetsUseCase } from '../../../application/share/ListSharedPetsUseCase';
import { PetShareMapper } from '../../mappers/PetShareMapper';
import { PetMapper } from '../../mappers/PetMapper';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';
import { Validate } from '../decorators/Validate';
import { CreateShareSchema, CreateShareBody, UpdateSharePermissionsSchema, UpdateSharePermissionsBody } from '../schemas/shareSchemas';

@JsonController('/pets')
@Service()
@UseBefore(authMiddleware)
export class ShareController {
  constructor(
    private readonly sharePet: SharePetUseCase,
    private readonly updateSharePermissions: UpdateSharePermissionsUseCase,
    private readonly revokeShare: RevokeShareUseCase,
    private readonly listPetShares: ListPetSharesUseCase,
    private readonly listSharedPets: ListSharedPetsUseCase,
    private readonly shareMapper: PetShareMapper,
    private readonly petMapper: PetMapper,
  ) {}

  @Get('/shared-with-me')
  async listSharedWithMe(@CurrentUser() user: AuthPayload) {
    const results = await this.listSharedPets.execute(user.userId);
    return results.map(({ pet, share }) => ({
      ...this.petMapper.toResponse(pet),
      permissions: {
        canViewVetVisits: share.canViewVetVisits,
        canEditVetVisits: share.canEditVetVisits,
        canViewMedications: share.canViewMedications,
        canEditMedications: share.canEditMedications,
        canViewNotes: share.canViewNotes,
        canEditNotes: share.canEditNotes,
      },
      shareId: share.id.toValue(),
    }));
  }

  @Get('/:petId/shares')
  async listForPet(@Param('petId') petId: string, @CurrentUser() user: AuthPayload) {
    const shares = await this.listPetShares.execute(petId, user.userId);
    return shares.map(s => this.shareMapper.toOwnerResponse(s));
  }

  @Post('/:petId/shares')
  @HttpCode(201)
  @Validate({ body: CreateShareSchema })
  async create(@Param('petId') petId: string, @Body() body: CreateShareBody, @CurrentUser() user: AuthPayload) {
    const share = await this.sharePet.execute({ petId, requestingUserId: user.userId, ...body });
    return this.shareMapper.toOwnerResponse(share);
  }

  @Put('/:petId/shares/:shareId')
  @Validate({ body: UpdateSharePermissionsSchema })
  async update(@Param('petId') petId: string, @Param('shareId') shareId: string, @Body() body: UpdateSharePermissionsBody, @CurrentUser() user: AuthPayload) {
    const share = await this.updateSharePermissions.execute({ petId, shareId, requestingUserId: user.userId, ...body });
    return this.shareMapper.toOwnerResponse(share);
  }

  @Delete('/:petId/shares/:shareId')
  @OnUndefined(204)
  async revoke(@Param('petId') petId: string, @Param('shareId') shareId: string, @CurrentUser() user: AuthPayload) {
    await this.revokeShare.execute(petId, shareId, user.userId);
  }
}
