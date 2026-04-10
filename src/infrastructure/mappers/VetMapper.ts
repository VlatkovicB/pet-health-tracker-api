import { Service } from 'typedi';
import { VetModel } from '../db/models/VetModel';
import { Vet } from '../../domain/vet/Vet';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';

export interface VetResponseDto {
  id: string;
  groupId: string;
  name: string;
  address?: string;
  phone?: string;
  workHours?: string;
  googleMapsUrl?: string;
  notes?: string;
  createdAt: string;
}

@Service()
export class VetMapper {
  toDomain(model: VetModel): Vet {
    return Vet.reconstitute(
      {
        groupId: model.groupId,
        name: model.name,
        address: model.address ?? undefined,
        phone: model.phone ?? undefined,
        workHours: model.workHours ?? undefined,
        googleMapsUrl: model.googleMapsUrl ?? undefined,
        notes: model.notes ?? undefined,
        createdAt: model.createdAt,
      },
      new UniqueEntityId(model.id),
    );
  }

  toPersistence(vet: Vet): object {
    return {
      id: vet.id.toValue(),
      groupId: vet.groupId,
      name: vet.name,
      address: vet.address ?? null,
      phone: vet.phone ?? null,
      workHours: vet.workHours ?? null,
      googleMapsUrl: vet.googleMapsUrl ?? null,
      notes: vet.notes ?? null,
      createdAt: vet.createdAt,
    };
  }

  toResponse(vet: Vet): VetResponseDto {
    return {
      id: vet.id.toValue(),
      groupId: vet.groupId,
      name: vet.name,
      address: vet.address,
      phone: vet.phone,
      workHours: vet.workHours,
      googleMapsUrl: vet.googleMapsUrl,
      notes: vet.notes,
      createdAt: vet.createdAt.toISOString(),
    };
  }
}
