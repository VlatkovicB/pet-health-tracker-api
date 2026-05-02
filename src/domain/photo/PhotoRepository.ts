import { Photo, PhotoSourceType } from './Photo';

export const PHOTO_REPOSITORY = 'PhotoRepository';

export interface PhotoRepository {
  save(photo: Photo): Promise<Photo>;
  findById(id: string): Promise<Photo | null>;
  findByPetIds(petIds: string[], year: number, sourceTypes?: PhotoSourceType[]): Promise<Photo[]>;
  findYearsByOwnerId(ownerId: string, petIds?: string[], sourceTypes?: PhotoSourceType[]): Promise<number[]>;
  delete(id: string): Promise<void>;
}
