// pet-health-tracker-api/src/infrastructure/mappers/VetMapper.ts
import { Service } from 'typedi';
import { v4 as uuidv4 } from 'uuid';
import { VetModel } from '../db/models/VetModel';
import { Vet, VetWorkHoursProps } from '../../domain/vet/Vet';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';
import type { DayOfWeek } from '../../domain/health/value-objects/ReminderSchedule';

export interface WorkHoursDayDto {
  dayOfWeek: string;
  open: boolean;
  startTime?: string;
  endTime?: string;
}

export interface VetResponseDto {
  id: string;
  userId: string;
  name: string;
  address?: string;
  phone?: string;
  workHours?: WorkHoursDayDto[];
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
        workHours: (model.workHours ?? []).map((wh) => ({
          dayOfWeek: wh.dayOfWeek as DayOfWeek,
          open: wh.open,
          startTime: wh.startTime ?? undefined,
          endTime: wh.endTime ?? undefined,
        })),
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

  toWorkHoursPersistence(vetId: string, hours: VetWorkHoursProps[]): object[] {
    return hours.map((wh) => ({
      id: uuidv4(),
      vetId,
      dayOfWeek: wh.dayOfWeek,
      open: wh.open,
      startTime: wh.open ? (wh.startTime ?? null) : null,
      endTime: wh.open ? (wh.endTime ?? null) : null,
    }));
  }

  toResponse(vet: Vet): VetResponseDto {
    return {
      id: vet.id.toValue(),
      userId: vet.userId,
      name: vet.name,
      address: vet.address,
      phone: vet.phone,
      workHours: vet.workHours?.map((wh) => ({
        dayOfWeek: wh.dayOfWeek,
        open: wh.open,
        startTime: wh.startTime,
        endTime: wh.endTime,
      })),
      googleMapsUrl: vet.googleMapsUrl,
      rating: vet.rating,
      notes: vet.notes,
      createdAt: vet.createdAt.toISOString(),
    };
  }
}
