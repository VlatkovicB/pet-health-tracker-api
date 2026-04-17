import { Request, Response, NextFunction } from 'express';
import { Service } from 'typedi';
import { GooglePlacesClient } from '../../external/GooglePlacesClient';

@Service()
export class PlacesController {
  constructor(private readonly placesClient: GooglePlacesClient) {}

  search = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = (req.query.q as string | undefined)?.trim();
      if (!q) {
        res.status(400).json({ message: 'Missing query parameter: q' });
        return;
      }
      const results = await this.placesClient.search(q);
      res.json(results);
    } catch (err) {
      next(err);
    }
  };

  details = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const placeId = (req.query.placeId as string | undefined)?.trim();
      if (!placeId) {
        res.status(400).json({ message: 'Missing query parameter: placeId' });
        return;
      }
      const detail = await this.placesClient.details(placeId);
      res.json(detail);
    } catch (err) {
      next(err);
    }
  };
}
