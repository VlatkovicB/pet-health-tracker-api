import { Service } from 'typedi';
import { VetModel } from '../db/models/VetModel';
import { Vet } from '../../domain/vet/Vet';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';

export interface VetResponseDto {
  id: string;
  userId: string;
  name: string;
  address?: string;
  phone?: string;
  workHours?: string;
  googleMapsUrl?: string;
  rating?: number;
  notes?: string;
  createdAt: string;
}

@Service()
export class VetMapper {
  toDomain(model: VetModel): Vet {
    return Vet.reconstitute(
      {
        userId: model.userId,
        name: model.name,
        address: model.address ?? undefined,
        phone: model.phone ?? undefined,
        googleMapsUrl: model.googleMapsUrl ?? undefined,
        rating: model.rating ?? undefined,
        notes: model.notes ?? undefined,
        createdAt: model.createdAt,
      },
      new UniqueEntityId(model.id),
    );
  }

  toPersistence(vet: Vet): object {
    return {
      id: vet.id.toValue(),
      userId: vet.userId,
      name: vet.name,
      address: vet.address ?? null,
      phone: vet.phone ?? null,
      googleMapsUrl: vet.googleMapsUrl ?? null,
      rating: vet.rating ?? null,
      notes: vet.notes ?? null,
      createdAt: vet.createdAt,
    };
  }

  toResponse(vet: Vet): VetResponseDto {
    return {
      id: vet.id.toValue(),
      userId: vet.userId,
      name: vet.name,
      address: vet.address,
      phone: vet.phone,
      workHours: vet.workHours,
      googleMapsUrl: vet.googleMapsUrl,
      rating: vet.rating,
      notes: vet.notes,
      createdAt: vet.createdAt.toISOString(),
    };
  }
}
