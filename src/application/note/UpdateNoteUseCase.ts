import { Inject, Service } from 'typedi';
import { NoteRepository, NOTE_REPOSITORY } from '../../domain/note/NoteRepository';
import { Note } from '../../domain/note/Note';
import { NoteMapper, NoteResponseDto } from '../../infrastructure/mappers/NoteMapper';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';

export interface UpdateNoteInput {
  userId: string;
  noteId: string;
  title?: string;
  description?: string;
  noteDate?: string;
  petIds?: string[];
}

@Service()
export class UpdateNoteUseCase {
  constructor(
    @Inject(NOTE_REPOSITORY) private readonly noteRepository: NoteRepository,
    private readonly noteMapper: NoteMapper,
  ) {}

  async execute(input: UpdateNoteInput): Promise<NoteResponseDto> {
    const existing = await this.noteRepository.findById(input.noteId);
    if (!existing) throw new NotFoundError('Note');
    if (existing.userId !== input.userId) throw new ForbiddenError('Not your note');

    const updated = Note.reconstitute(
      {
        userId: existing.userId,
        title: input.title ?? existing.title,
        description: input.description !== undefined ? input.description : existing.description,
        noteDate: input.noteDate ?? existing.noteDate,
        petIds: input.petIds !== undefined ? input.petIds : existing.petIds,
        imageUrls: existing.imageUrls,
        createdAt: existing.createdAt,
      },
      new UniqueEntityId(existing.id.toValue()),
    );

    const saved = await this.noteRepository.save(updated);
    return this.noteMapper.toResponse(saved);
  }
}
