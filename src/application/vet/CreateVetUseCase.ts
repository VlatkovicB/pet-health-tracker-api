import { Inject, Service } from 'typedi';
import { VetRepository, VET_REPOSITORY } from '../../domain/vet/VetRepository';
import { Vet, VetWorkHoursProps } from '../../domain/vet/Vet';

interface CreateVetInput {
  name: string;
  address?: string;
  phone?: string;
  workHours?: VetWorkHoursProps[];
  googleMapsUrl?: string;
  rating?: number;
  notes?: string;
  requestingUserId: string;
}

@Service()
export class CreateVetUseCase {
  constructor(
    @Inject(VET_REPOSITORY) private readonly vetRepository: VetRepository,
  ) {}

  async execute(input: CreateVetInput): Promise<Vet> {
    const vet = Vet.create({
      userId: input.requestingUserId,
      name: input.name,
      address: input.address,
      phone: input.phone,
      workHours: input.workHours,
      googleMapsUrl: input.googleMapsUrl,
      rating: input.rating,
      notes: input.notes,
    });

    await this.vetRepository.save(vet);
    return vet;
  }
}
