import { Entity } from '../shared/Entity';
import { UniqueEntityId } from '../shared/UniqueEntityId';

export type PhotoSourceType = 'standalone' | 'vet-visit' | 'note' | 'weight-entry';

interface PhotoProps {
  petId: string;
  ownerId: string;
  s3Key: string;
  takenAt: string; // 'YYYY-MM-DD'
  caption?: string;
  sourceType: PhotoSourceType;
  sourceId?: string;
  sizeBytes: number;
  createdAt: Date;
}

export class Photo extends Entity<PhotoProps> {
  get petId(): string { return this.props.petId; }
  get ownerId(): string { return this.props.ownerId; }
  get s3Key(): string { return this.props.s3Key; }
  get takenAt(): string { return this.props.takenAt; }
  get caption(): string | undefined { return this.props.caption; }
  get sourceType(): PhotoSourceType { return this.props.sourceType; }
  get sourceId(): string | undefined { return this.props.sourceId; }
  get sizeBytes(): number { return this.props.sizeBytes; }
  get createdAt(): Date { return this.props.createdAt; }

  static create(props: Omit<PhotoProps, 'createdAt' | 'sizeBytes'> & { sizeBytes?: number }, id?: UniqueEntityId): Photo {
    return new Photo({ ...props, sizeBytes: props.sizeBytes ?? 0, createdAt: new Date() }, id);
  }

  static reconstitute(props: PhotoProps, id: UniqueEntityId): Photo {
    return new Photo(props, id);
  }
}
