import { Inject, Service } from 'typedi';
import { NoteRepository, NOTE_REPOSITORY } from '../../domain/note/NoteRepository';
import { Note } from '../../domain/note/Note';
import { NoteMapper, NoteResponseDto } from '../../infrastructure/mappers/NoteMapper';
import { PetAccessService } from '../pet/PetAccessService';
import { LimitService } from '../limits/LimitService';

export interface CreateNoteInput {
  userId: string;
  title: string;
  description?: string;
  noteDate: string;
  petIds?: string[];
}

@Service()
export class CreateNoteUseCase {
  constructor(
    @Inject(NOTE_REPOSITORY) private readonly noteRepository: NoteRepository,
    private readonly noteMapper: NoteMapper,
    private readonly petAccessService: PetAccessService,
    private readonly limitService: LimitService,
  ) {}

  async execute(input: CreateNoteInput): Promise<NoteResponseDto> {
    await this.limitService.checkNoteLimit(input.userId);

    for (const petId of input.petIds ?? []) {
      await this.petAccessService.assertCanAccess(petId, input.userId, 'edit_notes');
    }

    const note = Note.create({
      userId: input.userId,
      title: input.title,
      description: input.description,
      noteDate: input.noteDate,
      petIds: input.petIds ?? [],
    });

    const saved = await this.noteRepository.save(note);
    return this.noteMapper.toResponse(saved);
  }
}
