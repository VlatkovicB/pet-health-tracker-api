import { BelongsTo, Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { NoteModel } from './NoteModel';
import { PetModel } from './PetModel';

@Table({ tableName: 'note_pet_tags', timestamps: false })
export class NotePetTagModel extends Model {
  @PrimaryKey
  @ForeignKey(() => NoteModel)
  @Column({ type: DataType.UUID, field: 'note_id' })
  declare noteId: string;

  @PrimaryKey
  @ForeignKey(() => PetModel)
  @Column({ type: DataType.UUID, field: 'pet_id' })
  declare petId: string;

  @BelongsTo(() => NoteModel)
  declare note: NoteModel;

  @BelongsTo(() => PetModel)
  declare pet: PetModel;
}
