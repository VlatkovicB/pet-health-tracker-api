import { JsonController, Get, Post, Put, Delete, Body, Param, QueryParams, UseBefore, CurrentUser, HttpCode, OnUndefined, Req } from 'routing-controllers';
import { Request } from 'express';
import { Service } from 'typedi';
import { CreateNoteUseCase } from '../../../application/note/CreateNoteUseCase';
import { ListNotesUseCase } from '../../../application/note/ListNotesUseCase';
import { UpdateNoteUseCase } from '../../../application/note/UpdateNoteUseCase';
import { DeleteNoteUseCase } from '../../../application/note/DeleteNoteUseCase';
import { AddNoteImageUseCase } from '../../../application/note/AddNoteImageUseCase';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';
import { uploadNoteImage } from '../middleware/upload';
import { AppError } from '../../../shared/errors/AppError';
import { Validate } from '../decorators/Validate';
import { CreateNoteSchema, CreateNoteBody, UpdateNoteSchema, UpdateNoteBody, ListNotesQuerySchema, ListNotesQuery } from '../schemas/noteSchemas';

@JsonController('/notes')
@Service()
@UseBefore(authMiddleware)
export class NoteController {
  constructor(
    private readonly createNote: CreateNoteUseCase,
    private readonly listNotes: ListNotesUseCase,
    private readonly updateNote: UpdateNoteUseCase,
    private readonly deleteNote: DeleteNoteUseCase,
    private readonly addNoteImage: AddNoteImageUseCase,
  ) {}

  @Post('/')
  @HttpCode(201)
  @Validate({ body: CreateNoteSchema })
  async create(@Body() body: CreateNoteBody, @CurrentUser() user: AuthPayload) {
    return this.createNote.execute({ userId: user.userId, ...body });
  }

  @Get('/')
  @Validate({ query: ListNotesQuerySchema })
  async list(@QueryParams() query: ListNotesQuery, @CurrentUser() user: AuthPayload) {
    return this.listNotes.execute({ userId: user.userId, ...query });
  }

  @Put('/:noteId')
  @Validate({ body: UpdateNoteSchema })
  async update(@Param('noteId') noteId: string, @Body() body: UpdateNoteBody, @CurrentUser() user: AuthPayload) {
    return this.updateNote.execute({ userId: user.userId, noteId, ...body });
  }

  @Delete('/:noteId')
  @OnUndefined(204)
  async delete(@Param('noteId') noteId: string, @CurrentUser() user: AuthPayload) {
    await this.deleteNote.execute({ userId: user.userId, noteId });
  }

  @Post('/:noteId/images')
  @UseBefore(uploadNoteImage.single('image'))
  async addImage(@Param('noteId') noteId: string, @Req() req: Request, @CurrentUser() user: AuthPayload) {
    if (!req.file) throw new AppError('No file uploaded', 400);
    const imageUrl = `/uploads/notes/${req.file.filename}`;
    return this.addNoteImage.execute({ userId: user.userId, noteId, imageUrl });
  }
}
