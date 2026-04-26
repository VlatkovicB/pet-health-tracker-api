import { JsonController, Get, QueryParams, UseBefore } from 'routing-controllers';
import { Service } from 'typedi';
import { GooglePlacesClient } from '../../external/GooglePlacesClient';
import { authMiddleware } from '../middleware/authMiddleware';
import { Validate } from '../decorators/Validate';
import { PlacesSearchQuerySchema, PlacesSearchQuery, PlacesDetailsQuerySchema, PlacesDetailsQuery } from '../schemas/placesSchemas';

@JsonController('/places')
@Service()
@UseBefore(authMiddleware)
export class PlacesController {
  constructor(private readonly placesClient: GooglePlacesClient) {}

  @Get('/search')
  @Validate({ query: PlacesSearchQuerySchema })
  async search(@QueryParams() query: PlacesSearchQuery) {
    return this.placesClient.search(query.q);
  }

  @Get('/details')
  @Validate({ query: PlacesDetailsQuerySchema })
  async details(@QueryParams() query: PlacesDetailsQuery) {
    return this.placesClient.details(query.placeId);
  }
}
