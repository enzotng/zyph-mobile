import { poiPhotoResponseSchema, poiSchema, poiSearchResponseSchema } from './poi.schemas'

// A fully-populated POI mirroring the shape emitted by normalizeGooglePlace
// (supabase/functions/_shared/google-places.ts): every key present, nullables carrying a value.
const fullPoi = {
  placeId: 'ChIJD7fiBh9u5kcRYJSMaMOCCwQ',
  name: 'Eiffel Tower',
  lat: 48.8584,
  lng: 2.2945,
  rating: 4.7,
  ratingCount: 318241,
  priceLevel: 2,
  types: ['tourist_attraction', 'point_of_interest'],
  photoName: 'places/ChIJD7fiBh9u5kcRYJSMaMOCCwQ/photos/AXC',
  address: 'Champ de Mars, 5 Av. Anatole France, Paris',
  openNow: true,
  description: 'Iconic wrought-iron lattice tower on the Champ de Mars.',
  typeLabel: 'Landmark',
  priceStart: 10,
  priceEnd: 30,
  priceCurrency: 'EUR',
  weekdayHours: ['Monday: 9 AM - 11 PM', 'Tuesday: 9 AM - 11 PM'],
}

// The same shape with every nullable field null - a sparse Google result the server still emits
// with all keys present.
const sparsePoi = {
  placeId: 'ChIJxyz',
  name: 'Some Place',
  lat: 1,
  lng: 2,
  rating: null,
  ratingCount: null,
  priceLevel: null,
  types: [],
  photoName: null,
  address: null,
  openNow: null,
  description: null,
  typeLabel: null,
  priceStart: null,
  priceEnd: null,
  priceCurrency: null,
  weekdayHours: null,
}

describe('poiSchema', () => {
  it('round-trips a fully-populated POI unchanged', () => {
    const parsed = poiSchema.safeParse(fullPoi)

    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data).toEqual(fullPoi)
  })

  it('accepts a POI with every nullable field null', () => {
    const parsed = poiSchema.safeParse(sparsePoi)

    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data).toEqual(sparsePoi)
  })

  it('rejects a POI missing a required field', () => {
    const withoutPlaceId: Record<string, unknown> = { ...fullPoi }
    delete withoutPlaceId.placeId

    expect(poiSchema.safeParse(withoutPlaceId).success).toBe(false)
  })

  it('rejects an empty placeId or name', () => {
    expect(poiSchema.safeParse({ ...fullPoi, placeId: '' }).success).toBe(false)
    expect(poiSchema.safeParse({ ...fullPoi, name: '' }).success).toBe(false)
  })

  it('rejects a required field of the wrong type', () => {
    expect(poiSchema.safeParse({ ...fullPoi, lat: 'nope' }).success).toBe(false)
    expect(poiSchema.safeParse({ ...fullPoi, types: 'nope' }).success).toBe(false)
  })

  it('rejects undefined in a nullable field (server always emits null, never undefined)', () => {
    expect(poiSchema.safeParse({ ...fullPoi, rating: undefined }).success).toBe(false)
  })
})

describe('poiSearchResponseSchema', () => {
  it('accepts an envelope whose pois is an array, without validating the items', () => {
    expect(poiSearchResponseSchema.safeParse({ pois: [fullPoi, {}] }).success).toBe(true)
  })

  it('rejects an envelope whose pois is missing or not an array', () => {
    expect(poiSearchResponseSchema.safeParse({}).success).toBe(false)
    expect(poiSearchResponseSchema.safeParse({ pois: 'nope' }).success).toBe(false)
    expect(poiSearchResponseSchema.safeParse('nope').success).toBe(false)
  })
})

describe('poiPhotoResponseSchema', () => {
  it('accepts a string photoUri and a null photoUri', () => {
    expect(poiPhotoResponseSchema.safeParse({ photoUri: 'https://x/y.jpg' }).success).toBe(true)
    expect(poiPhotoResponseSchema.safeParse({ photoUri: null }).success).toBe(true)
  })

  it('rejects a non-string, non-null photoUri', () => {
    expect(poiPhotoResponseSchema.safeParse({ photoUri: 123 }).success).toBe(false)
  })
})
