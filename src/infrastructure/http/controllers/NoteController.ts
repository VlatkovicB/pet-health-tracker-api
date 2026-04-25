import { Request, Response, NextFunction } from 'express';
import { Service } from 'typedi';
import { CreateNoteUseCase } from '../../../application/note/CreateNoteUseCase';
import { ListNotesUseCase } from '../../../application/note/ListNotesUseCase';
import { UpdateNoteUseCase } from '../../../application/note/UpdateNoteUseCase';
import { DeleteNoteUseCase } from '../../../application/note/DeleteNoteUseCase';
import { AddNoteImageUseCase } from '../../../application/note/AddNoteImageUseCase';

@Service()
export class NoteController {
  constructor(
    private readonly createNote: CreateNoteUseCase,
    private readonly listNotes: ListNotesUseCase,
    private readonly updateNote: UpdateNoteUseCase,
    private readonly deleteNote: DeleteNoteUseCase,
    private readonly addNoteImage: AddNoteImageUseCase,
  ) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const note = await this.createNote.execute({
        userId: req.auth.userId,
        title: req.body.title,
        description: req.body.description,
        noteDate: req.body.noteDate,
        petIds: req.body.petIds,
        imageUrls: req.body.imageUrls,
      });
      res.status(201).json(note);
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const notes = await this.listNotes.execute({
        userId: req.auth.userId,
        petId: req.query.petId as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
      });
      res.json(notes);
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const note = await this.updateNote.execute({
        userId: req.auth.userId,
        noteId: req.params.noteId,
        title: req.body.title,
        description: req.body.description,
        noteDate: req.body.noteDate,
        petIds: req.body.petIds,
      });
      res.json(note);
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.deleteNote.execute({
        userId: req.auth.userId,
        noteId: req.params.noteId,
      });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  addImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) { res.status(400).json({ message: 'No file uploaded' }); return; }
      const imageUrl = `/uploads/notes/${req.file.filename}`;
      const note = await this.addNoteImage.execute({
        userId: req.auth.userId,
        noteId: req.params.noteId,
        imageUrl,
      });
      res.json(note);
    } catch (err) {
      next(err);
    }
  };
}
