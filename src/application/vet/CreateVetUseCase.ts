import { Inject, Service } from 'typedi';
import { VetRepository, VET_REPOSITORY } from '../../domain/vet/VetRepository';
import { GroupRepository, GROUP_REPOSITORY } from '../../domain/group/GroupRepository';
import { Vet } from '../../domain/vet/Vet';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

interface CreateVetInput {
  groupId: string;
  name: string;
  address?: string;
  phone?: string;
  workHours?: string;
  googleMapsUrl?: string;
  notes?: string;
  requestingUserId: string;
}

@Service()
export class CreateVetUseCase {
  constructor(
    @Inject(VET_REPOSITORY) private readonly vetRepository: VetRepository,
    @Inject(GROUP_REPOSITORY) private readonly groupRepository: GroupRepository,
  ) {}

  async execute(input: CreateVetInput): Promise<Vet> {
    const group = await this.groupRepository.findById(input.groupId);
    if (!group) throw new NotFoundError('Group');
    if (!group.hasMember(input.requestingUserId)) throw new ForbiddenError('Not a group member');

    const vet = Vet.create({
      groupId: input.groupId,
      name: input.name,
      address: input.address,
      phone: input.phone,
      workHours: input.workHours,
      googleMapsUrl: input.googleMapsUrl,
      notes: input.notes,
    });

    await this.vetRepository.save(vet);
    return vet;
  }
}
