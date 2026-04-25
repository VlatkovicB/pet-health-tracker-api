import { Inject, Service } from 'typedi';
import { NoteRepository, NOTE_REPOSITORY } from '../../domain/note/NoteRepository';
import { Note } from '../../domain/note/Note';
import { NoteMapper, NoteResponseDto } from '../../infrastructure/mappers/NoteMapper';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

export interface AddNoteImageInput {
  userId: string;
  noteId: string;
  imageUrl: string;
}

@Service()
export class AddNoteImageUseCase {
  constructor(
    @Inject(NOTE_REPOSITORY) private readonly noteRepository: NoteRepository,
    private readonly noteMapper: NoteMapper,
  ) {}

  async execute(input: AddNoteImageInput): Promise<NoteResponseDto> {
    const existing = await this.noteRepository.findById(input.noteId);
    if (!existing) throw new NotFoundError('Note');
    if (existing.userId !== input.userId) throw new ForbiddenError('Not your note');

    const updated = Note.addImage(existing, input.imageUrl);
    const saved = await this.noteRepository.save(updated);
    return this.noteMapper.toResponse(saved);
  }
}
