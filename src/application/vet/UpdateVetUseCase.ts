import { Inject, Service } from 'typedi';
import { VetRepository, VET_REPOSITORY } from '../../domain/vet/VetRepository';
import { Vet, VetWorkHoursProps } from '../../domain/vet/Vet';

interface UpdateVetInput {
  vetId: string;
  name?: string;
  address?: string;
  phone?: string;
  workHours?: VetWorkHoursProps[];
  googleMapsUrl?: string;
  rating?: number;
  notes?: string;
  requestingUserId: string;
}

@Service()
export class UpdateVetUseCase {
  constructor(
    @Inject(VET_REPOSITORY) private readonly vetRepository: VetRepository,
  ) {}

  async execute(input: UpdateVetInput): Promise<Vet> {
    const vet = await this.vetRepository.findById(input.vetId);
    if (!vet) {
      const err = new Error('Vet not found') as any;
      err.status = 404;
      throw err;
    }
    if (vet.userId !== input.requestingUserId) {
      const err = new Error('Forbidden') as any;
      err.status = 403;
      throw err;
    }

    const updated = Vet.reconstitute(
      {
        userId: vet.userId,
        name: input.name ?? vet.name,
        address: input.address ?? vet.address,
        phone: input.phone ?? vet.phone,
        workHours: input.workHours ?? vet.workHours,
        googleMapsUrl: input.googleMapsUrl ?? vet.googleMapsUrl,
        rating: input.rating ?? vet.rating,
        notes: input.notes ?? vet.notes,
        createdAt: vet.createdAt,
      },
      vet.id,
    );

    await this.vetRepository.save(updated);
    return updated;
  }
}
