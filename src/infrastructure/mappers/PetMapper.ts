import { Service } from 'typedi';
import { PetModel } from '../db/models/PetModel';
import { Pet } from '../../domain/pet/Pet';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';

export interface PetResponseDto {
  id: string;
  name: string;
  species: string;
  breed?: string;
  birthDate?: string;
  photoUrl?: string;
  groupId: string;
  createdAt: string;
}

@Service()
export class PetMapper {
  toDomain(model: PetModel): Pet {
    return Pet.reconstitute(
      {
        name: model.name,
        species: model.species,
        breed: model.breed ?? undefined,
        birthDate: model.birthDate ?? undefined,
        photoUrl: model.photoUrl ?? undefined,
        groupId: model.groupId,
        createdAt: model.createdAt,
      },
      new UniqueEntityId(model.id),
    );
  }

  toPersistence(pet: Pet): object {
    return {
      id: pet.id.toValue(),
      name: pet.name,
      species: pet.species,
      breed: pet.breed ?? null,
      birthDate: pet.birthDate ?? null,
      photoUrl: pet.photoUrl ?? null,
      groupId: pet.groupId,
      createdAt: pet.createdAt,
    };
  }

  toResponse(pet: Pet): PetResponseDto {
    return {
      id: pet.id.toValue(),
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      birthDate: pet.birthDate?.toISOString(),
      photoUrl: pet.photoUrl,
      groupId: pet.groupId,
      createdAt: pet.createdAt.toISOString(),
    };
  }
}
