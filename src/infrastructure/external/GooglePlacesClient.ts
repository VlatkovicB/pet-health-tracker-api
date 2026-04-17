import { Service } from 'typedi';

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  address: string;
}

export interface PlaceDetails {
  name: string;
  address: string;
  phone?: string;
  workHours?: string;
  rating?: number;
  googleMapsUrl?: string;
}

@Service()
export class GooglePlacesClient {
  private readonly apiKey = process.env.GOOGLE_PLACES_API_KEY ?? '';
  private readonly baseUrl = 'https://places.googleapis.com/v1';

  async search(query: string): Promise<PlaceSearchResult[]> {
    const res = await fetch(`${this.baseUrl}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: 5 }),
    });

    if (!res.ok) {
      throw new Error(`Places search failed: ${res.status}`);
    }

    const data = await res.json() as {
      places?: Array<{ id: string; displayName: { text: string }; formattedAddress: string }>;
    };

    return (data.places ?? []).map((p) => ({
      placeId: p.id,
      name: p.displayName.text,
      address: p.formattedAddress,
    }));
  }

  async details(placeId: string): Promise<PlaceDetails> {
    const fieldMask = [
      'displayName',
      'formattedAddress',
      'internationalPhoneNumber',
      'rating',
      'regularOpeningHours',
      'googleMapsUri',
    ].join(',');

    const res = await fetch(`${this.baseUrl}/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
    });

    if (!res.ok) {
      throw new Error(`Places details failed: ${res.status}`);
    }

    const p = await res.json() as {
      displayName?: { text: string };
      formattedAddress?: string;
      internationalPhoneNumber?: string;
      rating?: number;
      regularOpeningHours?: { weekdayDescriptions?: string[] };
      googleMapsUri?: string;
    };

    const weekdays = p.regularOpeningHours?.weekdayDescriptions ?? [];

    return {
      name: p.displayName?.text ?? '',
      address: p.formattedAddress ?? '',
      phone: p.internationalPhoneNumber,
      workHours: weekdays.length > 0 ? weekdays.join('\n') : undefined,
      rating: p.rating,
      googleMapsUrl: p.googleMapsUri,
    };
  }
}
