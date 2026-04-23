import { Service } from 'typedi';
import { Note } from '../../domain/note/Note';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';
import { NoteModel } from '../db/models/NoteModel';

export interface NoteResponseDto {
  id: string;
  userId: string;
  title: string;
  description?: string;
  noteDate: string;
  petIds: string[];
  imageUrls: string[];
  createdAt: string;
}

@Service()
export class NoteMapper {
  toDomain(model: NoteModel): Note {
    return Note.reconstitute(
      {
        userId: model.userId,
        title: model.title,
        description: model.description ?? undefined,
        noteDate: model.noteDate,
        petIds: (model.petTags ?? []).map((t) => t.petId),
        imageUrls: model.imageUrls ?? [],
        createdAt: model.createdAt,
      },
      new UniqueEntityId(model.id),
    );
  }

  toPersistence(note: Note): object {
    return {
      id: note.id.toValue(),
      userId: note.userId,
      title: note.title,
      description: note.description ?? null,
      noteDate: note.noteDate,
      imageUrls: note.imageUrls,
      createdAt: note.createdAt,
    };
  }

  toResponse(note: Note): NoteResponseDto {
    return {
      id: note.id.toValue(),
      userId: note.userId,
      title: note.title,
      description: note.description,
      noteDate: note.noteDate,
      petIds: note.petIds,
      imageUrls: note.imageUrls,
      createdAt: note.createdAt.toISOString(),
    };
  }
}
