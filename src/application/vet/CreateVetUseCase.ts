import { Inject, Service } from 'typedi';
import { VetRepository, VET_REPOSITORY } from '../../domain/vet/VetRepository';
import { Vet, VetWorkHoursProps } from '../../domain/vet/Vet';
import { LimitService } from '../limits/LimitService';

interface CreateVetInput {
  name: string;
  address?: string;
  phone?: string;
  workHours?: VetWorkHoursProps[];
  googleMapsUrl?: string;
  rating?: number;
  placeId?: string;
  notes?: string;
  requestingUserId: string;
}

@Service()
export class CreateVetUseCase {
  constructor(
    @Inject(VET_REPOSITORY) private readonly vetRepository: VetRepository,
    private readonly limitService: LimitService,
  ) {}

  async execute(input: CreateVetInput): Promise<Vet> {
    await this.limitService.checkVetLimit(input.requestingUserId);

    const vet = Vet.create({
      userId: input.requestingUserId,
      name: input.name,
      address: input.address,
      phone: input.phone,
      workHours: input.workHours,
      googleMapsUrl: input.googleMapsUrl,
      rating: input.rating,
      placeId: input.placeId,
      notes: input.notes,
    });

    await this.vetRepository.save(vet);
    return vet;
  }
}
