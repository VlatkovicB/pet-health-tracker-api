import { Entity } from '../shared/Entity';
import { UniqueEntityId } from '../shared/UniqueEntityId';

export interface UserLimitsProps {
  userId: string;
  maxPets: number | null;
  maxVets: number | null;
  maxMedications: number | null;
  maxNotes: number | null;
  maxStorageBytes: number | null;
  storageUsedBytes: number;
  maxPlacesSearchesMonthly: number | null;
  placesSearchesThisMonth: number;
  placesSearchesMonth: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class UserLimits extends Entity<UserLimitsProps> {
  get userId(): string { return this.props.userId; }
  get maxPets(): number | null { return this.props.maxPets; }
  get maxVets(): number | null { return this.props.maxVets; }
  get maxMedications(): number | null { return this.props.maxMedications; }
  get maxNotes(): number | null { return this.props.maxNotes; }
  get maxStorageBytes(): number | null { return this.props.maxStorageBytes; }
  get storageUsedBytes(): number { return this.props.storageUsedBytes; }
  get maxPlacesSearchesMonthly(): number | null { return this.props.maxPlacesSearchesMonthly; }
  get placesSearchesThisMonth(): number { return this.props.placesSearchesThisMonth; }
  get placesSearchesMonth(): Date { return this.props.placesSearchesMonth; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  static create(userId: string): UserLimits {
    return new UserLimits({
      userId,
      maxPets: null, maxVets: null, maxMedications: null, maxNotes: null,
      maxStorageBytes: null, storageUsedBytes: 0,
      maxPlacesSearchesMonthly: null, placesSearchesThisMonth: 0,
      placesSearchesMonth: new Date(),
      createdAt: new Date(), updatedAt: new Date(),
    }, new UniqueEntityId());
  }

  static reconstitute(props: UserLimitsProps, id: UniqueEntityId): UserLimits {
    return new UserLimits(props, id);
  }
}
