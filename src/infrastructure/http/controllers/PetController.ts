import { Request, Response, NextFunction } from 'express';
import { Service } from 'typedi';
import { AddPetUseCase } from '../../../application/pet/AddPetUseCase';
import { ListPetsUseCase } from '../../../application/pet/ListPetsUseCase';
import { GetPetUseCase } from '../../../application/pet/GetPetUseCase';
import { UpdatePetUseCase } from '../../../application/pet/UpdatePetUseCase';
import { PetMapper } from '../../mappers/PetMapper';

@Service()
export class PetController {
  constructor(
    private readonly addPet: AddPetUseCase,
    private readonly listPets: ListPetsUseCase,
    private readonly getPet: GetPetUseCase,
    private readonly updatePet: UpdatePetUseCase,
    private readonly mapper: PetMapper,
  ) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pet = await this.addPet.execute({
        ...req.body,
        birthDate: req.body.birthDate ? new Date(req.body.birthDate) : undefined,
        groupId: req.params.groupId,
        requestingUserId: req.auth.userId,
      });
      res.status(201).json(this.mapper.toResponse(pet));
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const result = await this.listPets.execute(req.params.groupId, req.auth.userId, { page, limit });
      res.json({ ...result, items: result.items.map((p) => this.mapper.toResponse(p)) });
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pet = await this.getPet.execute(req.params.petId, req.auth.userId);
      res.json(this.mapper.toResponse(pet));
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pet = await this.updatePet.execute({
        petId: req.params.petId,
        name: req.body.name,
        species: req.body.species,
        breed: req.body.breed,
        birthDate: req.body.birthDate ? new Date(req.body.birthDate) : undefined,
        requestingUserId: req.auth.userId,
      });
      res.json(this.mapper.toResponse(pet));
    } catch (err) {
      next(err);
    }
  };

  uploadPhoto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) { res.status(400).json({ message: 'No file uploaded' }); return; }
      const photoUrl = `/uploads/pets/${req.file.filename}`;
      const pet = await this.updatePet.execute({
        petId: req.params.petId,
        photoUrl,
        requestingUserId: req.auth.userId,
      });
      res.json(this.mapper.toResponse(pet));
    } catch (err) {
      next(err);
    }
  };
}
