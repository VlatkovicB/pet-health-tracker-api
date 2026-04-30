import { WeightEntry } from './WeightEntry';

export const WEIGHT_ENTRY_REPOSITORY = 'WeightEntryRepository';

export interface WeightEntryRepository {
  save(entry: WeightEntry): Promise<WeightEntry>;
  findById(id: string): Promise<WeightEntry | null>;
  findByPetId(petId: string): Promise<WeightEntry[]>;
  delete(id: string): Promise<void>;
}
