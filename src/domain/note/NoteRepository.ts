import { Note } from './Note';

export const NOTE_REPOSITORY = 'NoteRepository';

export interface NoteRepository {
  save(note: Note): Promise<Note>;
  findById(id: string): Promise<Note | null>;
  findByUserId(
    userId: string,
    filters?: { petId?: string; from?: string; to?: string },
  ): Promise<Note[]>;
  delete(id: string): Promise<void>;
}
