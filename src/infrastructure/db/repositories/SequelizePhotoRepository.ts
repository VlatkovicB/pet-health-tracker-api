import { Service } from 'typedi';
import { Op } from 'sequelize';
import { Photo, PhotoSourceType } from '../../../domain/photo/Photo';
import { PhotoRepository } from '../../../domain/photo/PhotoRepository';
import { PhotoModel } from '../models/PhotoModel';
import { PhotoMapper } from '../../mappers/PhotoMapper';

@Service()
export class SequelizePhotoRepository implements PhotoRepository {
  constructor(private readonly mapper: PhotoMapper) {}

  async save(photo: Photo): Promise<Photo> {
    await PhotoModel.upsert(this.mapper.toPersistence(photo) as any);
    const saved = await this.findById(photo.id.toValue());
    if (!saved) throw new Error(`Photo ${photo.id.toValue()} not found after save`);
    return saved;
  }

  async findById(id: string): Promise<Photo | null> {
    const model = await PhotoModel.findByPk(id);
    return model ? this.mapper.toDomain(model) : null;
  }

  async findByPetIds(petIds: string[], year: number, sourceTypes?: PhotoSourceType[]): Promise<Photo[]> {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    const where: any = {
      petId: { [Op.in]: petIds },
      takenAt: { [Op.between]: [start, end] },
    };
    if (sourceTypes !== undefined) where.sourceType = { [Op.in]: sourceTypes };
    const models = await PhotoModel.findAll({
      where,
      order: [['taken_at', 'DESC']],
    });
    return models.map((m) => this.mapper.toDomain(m));
  }

  async findYearsByOwnerId(ownerId: string, petIds?: string[], sourceTypes?: PhotoSourceType[]): Promise<number[]> {
    const where: any = { ownerId };
    if (petIds?.length) where.petId = { [Op.in]: petIds };
    if (sourceTypes !== undefined) where.sourceType = { [Op.in]: sourceTypes };
    const models = await PhotoModel.findAll({
      attributes: [[PhotoModel.sequelize!.fn('DISTINCT', PhotoModel.sequelize!.fn('date_part', 'year', PhotoModel.sequelize!.col('taken_at'))), 'year']],
      where,
      order: [[PhotoModel.sequelize!.literal('year'), 'DESC']],
      raw: true,
    }) as any[];
    return models.map((m) => Number(m.year));
  }

  async delete(id: string): Promise<void> {
    await PhotoModel.destroy({ where: { id } });
  }
}
