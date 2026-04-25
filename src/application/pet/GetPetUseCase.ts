import { Service } from 'typedi';
import { Pet } from '../../domain/pet/Pet';
import { PetAccessService } from './PetAccessService';

@Service()
export class GetPetUseCase {
  constructor(
    private readonly petAccessService: PetAccessService,
  ) {}

  async execute(petId: string, requestingUserId: string): Promise<Pet> {
    return this.petAccessService.assertCanAccess(petId, requestingUserId, 'view_pet');
  }
}
