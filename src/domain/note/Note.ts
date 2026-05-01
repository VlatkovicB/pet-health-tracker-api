import { Entity } from '../shared/Entity';
import { UniqueEntityId } from '../shared/UniqueEntityId';

interface NoteProps {
  userId: string;
  title: string;
  description?: string;
  noteDate: string; // 'YYYY-MM-DD'
  petIds: string[];
  createdAt: Date;
}

export class Note extends Entity<NoteProps> {
  get userId(): string { return this.props.userId; }
  get title(): string { return this.props.title; }
  get description(): string | undefined { return this.props.description; }
  get noteDate(): string { return this.props.noteDate; }
  get petIds(): string[] { return this.props.petIds; }
  get createdAt(): Date { return this.props.createdAt; }

  static create(props: Omit<NoteProps, 'createdAt'>, id?: UniqueEntityId): Note {
    return new Note({ ...props, createdAt: new Date() }, id);
  }

  static reconstitute(props: NoteProps, id: UniqueEntityId): Note {
    return new Note(props, id);
  }
}
