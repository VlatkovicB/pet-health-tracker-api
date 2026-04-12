import { Request, Response, NextFunction } from 'express';
import { Service } from 'typedi';
import { CreateVetUseCase } from '../../../application/vet/CreateVetUseCase';
import { ListVetsUseCase } from '../../../application/vet/ListVetsUseCase';
import { VetMapper } from '../../mappers/VetMapper';

@Service()
export class VetController {
  constructor(
    private readonly createVet: CreateVetUseCase,
    private readonly listVets: ListVetsUseCase,
    private readonly mapper: VetMapper,
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const result = await this.listVets.execute(req.auth.userId, { page, limit });
      res.json({ ...result, items: result.items.map((v) => this.mapper.toResponse(v)) });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const vet = await this.createVet.execute({
        ...req.body,
        requestingUserId: req.auth.userId,
      });
      res.status(201).json(this.mapper.toResponse(vet));
    } catch (err) {
      next(err);
    }
  };
}
