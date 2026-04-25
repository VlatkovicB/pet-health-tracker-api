import { Inject, Service } from 'typedi';
import { NoteRepository, NOTE_REPOSITORY } from '../../domain/note/NoteRepository';
import { NoteMapper, NoteResponseDto } from '../../infrastructure/mappers/NoteMapper';
import { PetAccessService } from '../pet/PetAccessService';

export interface ListNotesInput {
  userId: string;
  petId?: string;
  from?: string;
  to?: string;
}

@Service()
export class ListNotesUseCase {
  constructor(
    @Inject(NOTE_REPOSITORY) private readonly noteRepository: NoteRepository,
    private readonly noteMapper: NoteMapper,
    private readonly petAccessService: PetAccessService,
  ) {}

  async execute(input: ListNotesInput): Promise<NoteResponseDto[]> {
    if (input.petId) {
      await this.petAccessService.assertCanAccess(input.petId, input.userId, 'view_notes');
    }
    const notes = await this.noteRepository.findByUserId(input.userId, {
      petId: input.petId,
      from: input.from,
      to: input.to,
    });

    return notes.map((n) => this.noteMapper.toResponse(n));
  }
}
