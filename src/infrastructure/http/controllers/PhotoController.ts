import {
  JsonController,
  Get,
  Post,
  Delete,
  Param,
  QueryParams,
  UseBefore,
  CurrentUser,
  HttpCode,
  OnUndefined,
  Req,
} from 'routing-controllers';
import { Request } from 'express';
import { Service } from 'typedi';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';
import { uploadImage, validateImageBuffer } from '../middleware/upload';
import { AppError } from '../../../shared/errors/AppError';
import { Validate } from '../decorators/Validate';
import {
  UploadPhotoSchema,
  AttachPhotoToNoteSchema,
  AttachPhotoToVisitSchema,
  PhotoTimelineQuerySchema,
  PhotoTimelineQuery,
  PhotoYearsQuerySchema,
  PhotoYearsQuery,
} from '../schemas/photoSchemas';
import { UploadStandalonePhotoUseCase } from '../../../application/photo/UploadStandalonePhotoUseCase';
import { AttachPhotoToVisitUseCase } from '../../../application/photo/AttachPhotoToVisitUseCase';
import { AttachPhotoToNoteUseCase } from '../../../application/photo/AttachPhotoToNoteUseCase';
import { AttachPhotoToWeightEntryUseCase } from '../../../application/photo/AttachPhotoToWeightEntryUseCase';
import { GetPhotoTimelineUseCase } from '../../../application/photo/GetPhotoTimelineUseCase';
import { GetPhotoYearsUseCase } from '../../../application/photo/GetPhotoYearsUseCase';
import { DeletePhotoUseCase } from '../../../application/photo/DeletePhotoUseCase';

@JsonController('/photos')
@Service()
@UseBefore(authMiddleware)
export class PhotoController {
  constructor(
    private readonly uploadStandalonePhoto: UploadStandalonePhotoUseCase,
    private readonly attachPhotoToVisit: AttachPhotoToVisitUseCase,
    private readonly attachPhotoToNote: AttachPhotoToNoteUseCase,
    private readonly attachWeightEntryPhoto: AttachPhotoToWeightEntryUseCase,
    private readonly getPhotoTimeline: GetPhotoTimelineUseCase,
    private readonly getPhotoYears: GetPhotoYearsUseCase,
    private readonly deletePhoto: DeletePhotoUseCase,
  ) {}

  @Post('/')
  @HttpCode(201)
  @UseBefore(uploadImage.single('file'))
  async upload(@Req() req: Request, @CurrentUser() user: AuthPayload) {
    if (!req.file) throw new AppError('No file uploaded', 400);
    const result = UploadPhotoSchema.safeParse(req.body);
    if (!result.success) {
      const msg = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new AppError(msg, 400);
    }
    const { petId, takenAt, caption } = result.data;
    const buffer = req.file.buffer;
    const mimeType = validateImageBuffer(buffer);
    return this.uploadStandalonePhoto.execute({ userId: user.userId, petId, buffer, mimeType, takenAt, caption });
  }

  @Post('/vet-visits/:visitId')
  @HttpCode(201)
  @UseBefore(uploadImage.single('file'))
  async attachToVisit(@Param('visitId') visitId: string, @Req() req: Request, @CurrentUser() user: AuthPayload) {
    if (!req.file) throw new AppError('No file uploaded', 400);
    const result = AttachPhotoToVisitSchema.safeParse(req.body);
    if (!result.success) {
      const msg = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new AppError(msg, 400);
    }
    const { takenAt, caption } = result.data;
    const buffer = req.file.buffer;
    const mimeType = validateImageBuffer(buffer);
    return this.attachPhotoToVisit.execute({ userId: user.userId, visitId, buffer, mimeType, takenAt, caption });
  }

  @Post('/notes/:noteId')
  @HttpCode(201)
  @UseBefore(uploadImage.single('file'))
  async attachToNote(@Param('noteId') noteId: string, @Req() req: Request, @CurrentUser() user: AuthPayload) {
    if (!req.file) throw new AppError('No file uploaded', 400);
    const result = AttachPhotoToNoteSchema.safeParse(req.body);
    if (!result.success) {
      const msg = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new AppError(msg, 400);
    }
    const { petId, takenAt, caption } = result.data;
    const buffer = req.file.buffer;
    const mimeType = validateImageBuffer(buffer);
    return this.attachPhotoToNote.execute({ userId: user.userId, noteId, petId, buffer, mimeType, takenAt, caption });
  }

  @Post('/weight-entries/:entryId')
  @HttpCode(201)
  @UseBefore(uploadImage.single('file'))
  async attachToWeightEntry(@Param('entryId') entryId: string, @Req() req: Request, @CurrentUser() user: AuthPayload) {
    if (!req.file) throw new AppError('No file uploaded', 400);
    const result = AttachPhotoToVisitSchema.safeParse(req.body);
    if (!result.success) {
      const msg = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new AppError(msg, 400);
    }
    const { takenAt, caption } = result.data;
    const buffer = req.file.buffer;
    const mimeType = validateImageBuffer(buffer);
    return this.attachWeightEntryPhoto.execute({ userId: user.userId, weightEntryId: entryId, buffer, mimeType, takenAt, caption });
  }

  @Get('/timeline')
  @Validate({ query: PhotoTimelineQuerySchema })
  async timeline(@QueryParams() query: PhotoTimelineQuery, @CurrentUser() user: AuthPayload) {
    return this.getPhotoTimeline.execute({ userId: user.userId, year: query.year, petIds: query.petIds });
  }

  @Get('/years')
  @Validate({ query: PhotoYearsQuerySchema })
  async years(@QueryParams() query: PhotoYearsQuery, @CurrentUser() user: AuthPayload) {
    return this.getPhotoYears.execute({ userId: user.userId, petIds: query.petIds });
  }

  @Delete('/:photoId')
  @OnUndefined(204)
  async delete(@Param('photoId') photoId: string, @CurrentUser() user: AuthPayload) {
    await this.deletePhoto.execute({ userId: user.userId, photoId });
  }
}
