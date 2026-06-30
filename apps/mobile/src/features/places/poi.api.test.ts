import { supabase } from '@/lib/supabase'
import { resolvePoiPhoto, searchPois } from './poi.api'
import type { Poi } from './poi.types'

jest.mock('@/lib/supabase')

const invoke = supabase.functions.invoke as jest.Mock

const fixturePoi: Poi = {
  placeId: 'ChIJD7fiBh9u5kcRYJSMaMOCCwQ',
  name: 'Eiffel Tower',
  lat: 48.8584,
  lng: 2.2945,
  rating: 4.7,
  ratingCount: 318241,
  priceLevel: null,
  types: ['tourist_attraction', 'point_of_interest'],
  photoName: 'places/ChIJD7fiBh9u5kcRYJSMaMOCCwQ/photos/AXC',
  address: 'Champ de Mars, 5 Av. Anatole France, Paris',
  openNow: true,
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('resolvePoiPhoto', () => {
  const photoName = 'places/x/photos/y'

  it('invokes poi-photo with body and returns data.photoUri', async () => {
    const uri = 'https://lh3.googleusercontent.com/photo.jpg'
    invoke.mockResolvedValue({ data: { photoUri: uri }, error: null })

    const result = await resolvePoiPhoto(photoName)

    expect(result).toBe(uri)
    expect(invoke).toHaveBeenCalledWith('poi-photo', { body: { photoName, maxWidthPx: 800 } })
  })

  it('returns null when invoke returns an error', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('network') })

    await expect(resolvePoiPhoto(photoName)).resolves.toBeNull()
  })
})

describe('searchPois', () => {
  const input = { lat: 48.8584, lng: 2.2945, includedTypes: ['tourist_attraction'], max: 10 }

  it('invokes poi-search with the body and returns data.pois', async () => {
    invoke.mockResolvedValue({ data: { pois: [fixturePoi] }, error: null })

    const result = await searchPois(input)

    expect(result).toEqual([fixturePoi])
    expect(invoke).toHaveBeenCalledWith('poi-search', { body: input })
  })

  it('returns [] when invoke returns an error', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('x') })

    await expect(searchPois(input)).resolves.toEqual([])
  })

  it('returns [] when data.pois is missing', async () => {
    invoke.mockResolvedValue({ data: {}, error: null })

    await expect(searchPois(input)).resolves.toEqual([])
  })
})
