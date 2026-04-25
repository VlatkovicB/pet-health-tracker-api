import { Request, Response, NextFunction } from 'express';
import { Service } from 'typedi';
import { SharePetUseCase } from '../../../application/share/SharePetUseCase';
import { UpdateSharePermissionsUseCase } from '../../../application/share/UpdateSharePermissionsUseCase';
import { RevokeShareUseCase } from '../../../application/share/RevokeShareUseCase';
import { ListPetSharesUseCase } from '../../../application/share/ListPetSharesUseCase';
import { ListPendingSharesUseCase } from '../../../application/share/ListPendingSharesUseCase';
import { AcceptShareUseCase } from '../../../application/share/AcceptShareUseCase';
import { DeclineShareUseCase } from '../../../application/share/DeclineShareUseCase';
import { ListSharedPetsUseCase } from '../../../application/share/ListSharedPetsUseCase';
import { PetShareMapper } from '../../mappers/PetShareMapper';
import { PetMapper } from '../../mappers/PetMapper';

@Service()
export class ShareController {
  constructor(
    private readonly sharePet: SharePetUseCase,
    private readonly updateSharePermissions: UpdateSharePermissionsUseCase,
    private readonly revokeShare: RevokeShareUseCase,
    private readonly listPetShares: ListPetSharesUseCase,
    private readonly listPendingShares: ListPendingSharesUseCase,
    private readonly acceptShare: AcceptShareUseCase,
    private readonly declineShare: DeclineShareUseCase,
    private readonly listSharedPets: ListSharedPetsUseCase,
    private readonly shareMapper: PetShareMapper,
    private readonly petMapper: PetMapper,
  ) {}

  listForPet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shares = await this.listPetShares.execute(req.params.petId, req.auth.userId);
      res.json(shares.map((s) => this.shareMapper.toResponse(s)));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const share = await this.sharePet.execute({
        petId: req.params.petId,
        requestingUserId: req.auth.userId,
        email: req.body.email,
        permissions: req.body.permissions,
      });
      res.status(201).json(this.shareMapper.toResponse(share));
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const share = await this.updateSharePermissions.execute({
        petId: req.params.petId,
        shareId: req.params.shareId,
        requestingUserId: req.auth.userId,
        ...req.body,
      });
      res.json(this.shareMapper.toResponse(share));
    } catch (err) { next(err); }
  };

  revoke = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.revokeShare.execute(req.params.petId, req.params.shareId, req.auth.userId);
      res.status(204).send();
    } catch (err) { next(err); }
  };

  listPending = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shares = await this.listPendingShares.execute(req.auth.userId);
      res.json(shares.map((s) => this.shareMapper.toResponse(s)));
    } catch (err) { next(err); }
  };

  accept = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.acceptShare.execute(req.params.shareId, req.auth.userId);
      res.status(204).send();
    } catch (err) { next(err); }
  };

  decline = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.declineShare.execute(req.params.shareId, req.auth.userId);
      res.status(204).send();
    } catch (err) { next(err); }
  };

  listSharedWithMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const results = await this.listSharedPets.execute(req.auth.userId);
      res.json(results.map(({ pet, share }) => ({
        ...this.petMapper.toResponse(pet),
        permissions: this.shareMapper.toResponse(share).permissions,
        shareId: share.id.toValue(),
      })));
    } catch (err) { next(err); }
  };
}
