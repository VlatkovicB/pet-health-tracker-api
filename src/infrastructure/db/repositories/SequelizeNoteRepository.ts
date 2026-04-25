import { Service } from 'typedi';
import { Op } from 'sequelize';
import { Note } from '../../../domain/note/Note';
import { NoteRepository } from '../../../domain/note/NoteRepository';
import { NoteModel } from '../models/NoteModel';
import { NotePetTagModel } from '../models/NotePetTagModel';
import { NoteMapper } from '../../mappers/NoteMapper';
import { sequelize } from '../database';

@Service()
export class SequelizeNoteRepository implements NoteRepository {
  constructor(private readonly noteMapper: NoteMapper) {}

  async save(note: Note): Promise<Note> {
    const id = note.id.toValue();
    await sequelize.transaction(async (t) => {
      await NoteModel.upsert(this.noteMapper.toPersistence(note) as any, { transaction: t });
      await NotePetTagModel.destroy({ where: { noteId: id }, transaction: t });
      if (note.petIds.length > 0) {
        await NotePetTagModel.bulkCreate(
          note.petIds.map((petId) => ({ noteId: id, petId })),
          { transaction: t },
        );
      }
    });
    const saved = await this.findById(id);
    if (!saved) throw new Error(`Note ${id} not found after save`);
    return saved;
  }

  async findById(id: string): Promise<Note | null> {
    const model = await NoteModel.findByPk(id, {
      include: [{ model: NotePetTagModel }],
    });
    return model ? this.noteMapper.toDomain(model) : null;
  }

  async findByUserId(
    userId: string,
    filters: { petId?: string; from?: string; to?: string } = {},
  ): Promise<Note[]> {
    const where: Record<string, unknown> = { userId };
    if (filters.from || filters.to) {
      where.noteDate = {
        ...(filters.from ? { [Op.gte]: filters.from } : {}),
        ...(filters.to ? { [Op.lte]: filters.to } : {}),
      };
    }
    const models = await NoteModel.findAll({
      where,
      include: [{ model: NotePetTagModel }],
      order: [['note_date', 'DESC']],
    });
    const notes = models.map((m) => this.noteMapper.toDomain(m));
    if (filters.petId) {
      return notes.filter((n) => n.petIds.includes(filters.petId!));
    }
    return notes;
  }

  async delete(id: string): Promise<void> {
    await sequelize.transaction(async (t) => {
      await NotePetTagModel.destroy({ where: { noteId: id }, transaction: t });
      await NoteModel.destroy({ where: { id }, transaction: t });
    });
  }
}
