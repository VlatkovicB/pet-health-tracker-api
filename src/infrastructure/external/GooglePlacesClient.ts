import { Service } from 'typedi';
import type { VetWorkHoursProps } from '../../domain/vet/Vet';

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  address: string;
}

export interface PlaceDetails {
  name: string;
  address: string;
  phone?: string;
  workHours?: VetWorkHoursProps[];
  rating?: number;
  googleMapsUrl?: string;
}

type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

const DAY_MAP: DayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function toTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseWorkHourPeriods(
  periods: Array<{
    open: { day: number; hour: number; minute: number };
    close?: { day: number; hour: number; minute: number };
  }>,
): VetWorkHoursProps[] {
  // 24/7 places: single period, opens Sunday 00:00, no close time
  const is24_7 =
    periods.length === 1 &&
    periods[0].open.day === 0 &&
    periods[0].open.hour === 0 &&
    periods[0].open.minute === 0 &&
    !periods[0].close;

  if (is24_7) {
    return DAY_MAP.map((dayOfWeek) => ({ dayOfWeek, open: true, startTime: '00:00', endTime: '23:59' }));
  }

  const byDay = new Map<number, { startTime: string; endTime: string }>();
  for (const p of periods) {
    byDay.set(p.open.day, {
      startTime: toTime(p.open.hour, p.open.minute),
      endTime: p.close ? toTime(p.close.hour, p.close.minute) : '23:59',
    });
  }
  return DAY_MAP.map((dayOfWeek, i) => {
    const times = byDay.get(i);
    return times ? { dayOfWeek, open: true, ...times } : { dayOfWeek, open: false };
  });
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
      'regularOpeningHours.periods',
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
      regularOpeningHours?: {
        periods?: Array<{
          open: { day: number; hour: number; minute: number };
          close?: { day: number; hour: number; minute: number };
        }>;
      };
      googleMapsUri?: string;
    };

    const periods = p.regularOpeningHours?.periods ?? [];

    return {
      name: p.displayName?.text ?? '',
      address: p.formattedAddress ?? '',
      phone: p.internationalPhoneNumber,
      workHours: periods.length > 0 ? parseWorkHourPeriods(periods) : undefined,
      rating: p.rating,
      googleMapsUrl: p.googleMapsUri,
    };
  }
}
