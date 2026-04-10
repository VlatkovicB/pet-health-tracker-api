import { Service } from 'typedi';
import { VetVisitModel } from '../db/models/VetVisitModel';
import { VetVisit } from '../../domain/health/VetVisit';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';

export interface VetVisitResponseDto {
  id: string;
  petId: string;
  vetId?: string;
  visitDate: string;
  clinic?: string;
  vetName?: string;
  reason: string;
  notes?: string;
  nextVisitDate?: string;
  imageUrls: string[];
  createdBy: string;
  createdAt: string;
}

@Service()
export class VetVisitMapper {
  toDomain(model: VetVisitModel): VetVisit {
    return VetVisit.reconstitute(
      {
        petId: model.petId,
        vetId: model.vetId ?? undefined,
        visitDate: model.visitDate,
        clinic: model.clinic ?? undefined,
        vetName: model.vetName ?? undefined,
        reason: model.reason,
        notes: model.notes ?? undefined,
        nextVisitDate: model.nextVisitDate ?? undefined,
        imageUrls: model.imageUrls ?? [],
        createdBy: model.createdBy,
        createdAt: model.createdAt,
      },
      new UniqueEntityId(model.id),
    );
  }

  toPersistence(visit: VetVisit): object {
    return {
      id: visit.id.toValue(),
      petId: visit.petId,
      vetId: visit.vetId ?? null,
      visitDate: visit.visitDate,
      clinic: visit.clinic ?? null,
      vetName: visit.vetName ?? null,
      reason: visit.reason,
      notes: visit.notes ?? null,
      nextVisitDate: visit.nextVisitDate ?? null,
      imageUrls: visit.imageUrls,
      createdBy: visit.createdBy,
      createdAt: visit.createdAt,
    };
  }

  toResponse(visit: VetVisit): VetVisitResponseDto {
    return {
      id: visit.id.toValue(),
      petId: visit.petId,
      vetId: visit.vetId,
      visitDate: visit.visitDate.toISOString(),
      clinic: visit.clinic,
      vetName: visit.vetName,
      reason: visit.reason,
      notes: visit.notes,
      nextVisitDate: visit.nextVisitDate?.toISOString(),
      imageUrls: visit.imageUrls,
      createdBy: visit.createdBy,
      createdAt: visit.createdAt.toISOString(),
    };
  }
}
