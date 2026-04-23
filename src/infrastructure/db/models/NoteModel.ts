import { BelongsTo, Column, DataType, ForeignKey, HasMany, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { UserModel } from './UserModel';
import { NotePetTagModel } from './NotePetTagModel';

@Table({ tableName: 'notes', timestamps: false })
export class NoteModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  declare id: string;

  // userId is both the owner scope and the creator — no separate created_by column by design
  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  declare userId: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare title: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare description: string | null;

  @Column({ type: DataType.DATEONLY, allowNull: false, field: 'note_date' })
  declare noteDate: string;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: [], field: 'image_urls' })
  declare imageUrls: string[];

  @Column({ type: DataType.DATE, allowNull: false, field: 'created_at' })
  declare createdAt: Date;

  @BelongsTo(() => UserModel)
  declare user: UserModel;

  @HasMany(() => NotePetTagModel)
  declare petTags: NotePetTagModel[];
}
