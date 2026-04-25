import { Inject, Service } from 'typedi';
import { NoteRepository, NOTE_REPOSITORY } from '../../domain/note/NoteRepository';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

export interface DeleteNoteInput {
  userId: string;
  noteId: string;
}

@Service()
export class DeleteNoteUseCase {
  constructor(
    @Inject(NOTE_REPOSITORY) private readonly noteRepository: NoteRepository,
  ) {}

  async execute(input: DeleteNoteInput): Promise<void> {
    const existing = await this.noteRepository.findById(input.noteId);
    if (!existing) throw new NotFoundError('Note');
    if (existing.userId !== input.userId) throw new ForbiddenError('Not your note');

    await this.noteRepository.delete(input.noteId);
  }
}
