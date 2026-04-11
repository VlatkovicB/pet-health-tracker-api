import { Request, Response, NextFunction } from 'express';
import { Service } from 'typedi';
import { CreateGroupUseCase } from '../../../application/group/CreateGroupUseCase';
import { InviteUserUseCase } from '../../../application/group/InviteUserUseCase';
import { ListGroupsUseCase } from '../../../application/group/ListGroupsUseCase';
import { ListUpcomingVetVisitsUseCase } from '../../../application/health/ListUpcomingVetVisitsUseCase';
import { GroupMapper } from '../../mappers/GroupMapper';
import { VetVisitMapper } from '../../mappers/VetVisitMapper';

@Service()
export class GroupController {
  constructor(
    private readonly createGroup: CreateGroupUseCase,
    private readonly inviteUser: InviteUserUseCase,
    private readonly listGroups: ListGroupsUseCase,
    private readonly listUpcomingVetVisits: ListUpcomingVetVisitsUseCase,
    private readonly mapper: GroupMapper,
    private readonly vetVisitMapper: VetVisitMapper,
  ) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const group = await this.createGroup.execute({
        name: req.body.name,
        ownerUserId: req.auth.userId,
      });
      res.status(201).json(this.mapper.toResponse(group));
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const result = await this.listGroups.execute(req.auth.userId, { page, limit });
      res.json({ ...result, items: result.items.map((g) => this.mapper.toResponse(g)) });
    } catch (err) {
      next(err);
    }
  };

  invite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.inviteUser.execute({
        groupId: req.params.groupId,
        inviterUserId: req.auth.userId,
        inviteeEmail: req.body.email,
      });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  upcomingVetVisits = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const visits = await this.listUpcomingVetVisits.execute(req.params.groupId, req.auth.userId);
      res.json(visits.map((v) => this.vetVisitMapper.toResponse(v)));
    } catch (err) {
      next(err);
    }
  };
}
