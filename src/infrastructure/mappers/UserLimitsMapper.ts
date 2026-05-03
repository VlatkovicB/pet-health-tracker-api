import { Service } from 'typedi';
import { UserLimitsModel } from '../db/models/UserLimitsModel';
import { UserLimits } from '../../domain/user/UserLimits';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';

@Service()
export class UserLimitsMapper {
  toDomain(model: UserLimitsModel): UserLimits {
    return UserLimits.reconstitute(
      {
        userId: model.userId,
        maxPets: model.maxPets,
        maxVets: model.maxVets,
        maxMedications: model.maxMedications,
        maxNotes: model.maxNotes,
        maxStorageBytes: model.maxStorageBytes !== null ? Number(model.maxStorageBytes) : null,
        storageUsedBytes: Number(model.storageUsedBytes),
        maxPlacesSearchesMonthly: model.maxPlacesSearchesMonthly,
        placesSearchesThisMonth: model.placesSearchesThisMonth,
        placesSearchesMonth: new Date(model.placesSearchesMonth),
        createdAt: model.createdAt,
        updatedAt: model.updatedAt,
      },
      new UniqueEntityId(model.id),
    );
  }
}
