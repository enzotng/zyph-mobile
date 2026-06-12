import { renderHook, waitFor } from '@testing-library/react-native'

import { createQueryWrapper } from '@/test-utils/query-wrapper'
import type { TripDocument } from '../api/media.api'
import * as api from '../api/media.api'
import {
  eventDocumentsQueryKey,
  tripDocumentsQueryKey,
  useDeleteDocument,
  useDeleteTripDocument,
  useEventDocuments,
  useTripDocuments,
  useUploadDocument,
  useUploadTripDocument,
} from './use-documents'

jest.mock('@/lib/supabase')
jest.mock('../api/media.api')

const doc: TripDocument = {
  id: 'd1',
  trip_id: 'trip1',
  event_id: 'ev1',
  owner_id: 'u1',
  storage_path: 'trip1/123456-789.pdf',
  kind: 'document',
  name: 'invoice.pdf',
  mime_type: 'application/pdf',
  size_bytes: 1024,
  height: null,
  width: null,
  created_at: '2026-05-22T00:00:00Z',
}

const uploadInput = {
  tripId: 'trip1',
  eventId: 'ev1',
  uri: 'file:///cache/invoice.pdf',
  name: 'invoice.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('useEventDocuments', () => {
  it('fetches the document list for an event', async () => {
    jest.mocked(api.listEventDocuments).mockResolvedValue([doc])
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useEventDocuments('ev1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([doc])
    expect(api.listEventDocuments).toHaveBeenCalledWith('ev1')
  })

  it('is disabled when eventId is empty', () => {
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useEventDocuments(''), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(api.listEventDocuments).not.toHaveBeenCalled()
  })
})

describe('useUploadDocument', () => {
  it('uploads and invalidates the documents query key on success', async () => {
    jest.mocked(api.uploadDocument).mockResolvedValue(doc)
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUploadDocument('ev1'), { wrapper })
    result.current.mutate(uploadInput)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(doc)
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: eventDocumentsQueryKey('ev1'),
    })
  })

  it('surfaces an upload error', async () => {
    jest.mocked(api.uploadDocument).mockRejectedValue(new Error('upload failed'))
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useUploadDocument('ev1'), { wrapper })
    result.current.mutate(uploadInput)

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(Error)
  })
})

describe('useDeleteDocument', () => {
  it('deletes the document and invalidates the query key on success', async () => {
    jest.mocked(api.deleteDocument).mockResolvedValue(undefined)
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useDeleteDocument('ev1'), { wrapper })
    result.current.mutate(doc)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.deleteDocument).toHaveBeenCalledWith(doc)
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: eventDocumentsQueryKey('ev1'),
    })
  })

  it('surfaces a deletion error', async () => {
    jest.mocked(api.deleteDocument).mockRejectedValue(new Error('delete failed'))
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useDeleteDocument('ev1'), { wrapper })
    result.current.mutate(doc)

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(Error)
  })
})

const tripDoc: TripDocument = { ...doc, id: 'd2', event_id: null }
const tripUploadInput = { ...uploadInput, eventId: null }

describe('useTripDocuments', () => {
  it('fetches every document for a trip', async () => {
    jest.mocked(api.listTripDocuments).mockResolvedValue([doc])
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useTripDocuments('trip1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([doc])
    expect(api.listTripDocuments).toHaveBeenCalledWith('trip1')
  })

  it('is disabled when tripId is empty', () => {
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useTripDocuments(''), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(api.listTripDocuments).not.toHaveBeenCalled()
  })
})

describe('useUploadTripDocument', () => {
  it('uploads a trip-level doc and invalidates the trip documents query', async () => {
    jest.mocked(api.uploadDocument).mockResolvedValue(tripDoc)
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUploadTripDocument('trip1'), { wrapper })
    result.current.mutate(tripUploadInput)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: tripDocumentsQueryKey('trip1') })
  })
})

describe('useDeleteTripDocument', () => {
  it('deletes and invalidates the trip documents query', async () => {
    jest.mocked(api.deleteDocument).mockResolvedValue(undefined)
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useDeleteTripDocument('trip1'), { wrapper })
    result.current.mutate(tripDoc)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.deleteDocument).toHaveBeenCalledWith(tripDoc)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: tripDocumentsQueryKey('trip1') })
  })
})
