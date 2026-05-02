import { Photo, PhotoSourceType } from './Photo';

export const PHOTO_REPOSITORY = 'PhotoRepository';

export interface PhotoRepository {
  save(photo: Photo): Promise<Photo>;
  findById(id: string): Promise<Photo | null>;
  /**
   * Finds photos by pet IDs within a specific year.
   * @param sourceTypes - When `undefined`: no source-type filter applied (returns all). When `[]`: returns nothing (no matching source types).
   */
  findByPetIds(petIds: string[], year: number, sourceTypes?: PhotoSourceType[]): Promise<Photo[]>;
  /**
   * Finds distinct years of photos owned by a user.
   * @param sourceTypes - When `undefined`: no source-type filter applied (returns all). When `[]`: returns nothing (no matching source types).
   */
  findYearsByOwnerId(ownerId: string, petIds?: string[], sourceTypes?: PhotoSourceType[]): Promise<number[]>;
  delete(id: string): Promise<void>;
}
