import { JsonController, Get, QueryParams, UseBefore, CurrentUser } from 'routing-controllers';
import { Service } from 'typedi';
import { GooglePlacesClient } from '../../external/GooglePlacesClient';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';
import { Validate } from '../decorators/Validate';
import { PlacesSearchQuerySchema, PlacesSearchQuery, PlacesDetailsQuerySchema, PlacesDetailsQuery } from '../schemas/placesSchemas';
import { LimitService } from '../../../application/limits/LimitService';

@JsonController('/places')
@Service()
@UseBefore(authMiddleware)
export class PlacesController {
  constructor(
    private readonly placesClient: GooglePlacesClient,
    private readonly limitService: LimitService,
  ) {}

  @Get('/search')
  @Validate({ query: PlacesSearchQuerySchema })
  async search(@CurrentUser() user: AuthPayload, @QueryParams() query: PlacesSearchQuery) {
    await this.limitService.checkAndIncrementPlacesSearch(user.userId);
    return this.placesClient.search(query.q);
  }

  @Get('/details')
  @Validate({ query: PlacesDetailsQuerySchema })
  async details(@QueryParams() query: PlacesDetailsQuery) {
    return this.placesClient.details(query.placeId);
  }
}
