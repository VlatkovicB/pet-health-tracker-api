import { Service } from 'typedi';
import { Photo, PhotoSourceType } from '../../domain/photo/Photo';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';
import { PhotoModel } from '../db/models/PhotoModel';

export interface PhotoResponseDto {
  id: string;
  petId: string;
  ownerId: string;
  url: string; // pre-signed URL, injected by use case
  takenAt: string;
  caption?: string;
  sourceType: PhotoSourceType;
  sourceId?: string;
  createdAt: string;
}

@Service()
export class PhotoMapper {
  toDomain(model: PhotoModel): Photo {
    return Photo.reconstitute(
      {
        petId: model.petId,
        ownerId: model.ownerId,
        s3Key: model.s3Key,
        takenAt: model.takenAt,
        caption: model.caption ?? undefined,
        sourceType: model.sourceType,
        sourceId: model.sourceId ?? undefined,
        createdAt: model.createdAt,
      },
      new UniqueEntityId(model.id),
    );
  }

  toPersistence(photo: Photo): object {
    return {
      id: photo.id.toValue(),
      petId: photo.petId,
      ownerId: photo.ownerId,
      s3Key: photo.s3Key,
      takenAt: photo.takenAt,
      caption: photo.caption ?? null,
      sourceType: photo.sourceType,
      sourceId: photo.sourceId ?? null,
      createdAt: photo.createdAt,
    };
  }

  toResponse(photo: Photo, signedUrl: string): PhotoResponseDto {
    return {
      id: photo.id.toValue(),
      petId: photo.petId,
      ownerId: photo.ownerId,
      url: signedUrl,
      takenAt: photo.takenAt,
      caption: photo.caption,
      sourceType: photo.sourceType,
      sourceId: photo.sourceId,
      createdAt: photo.createdAt.toISOString(),
    };
  }
}
