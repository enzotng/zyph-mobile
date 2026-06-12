import { supabase } from '@/lib/supabase'
import { makePostgrestError, makeQueryBuilder } from '@/test-utils/supabase-mock'

import {
  deleteDocument,
  getDocumentUrl,
  listEventDocuments,
  listTripDocuments,
  type TripDocument,
  uploadDocument,
} from './media.api'

jest.mock('@/lib/supabase')
jest.mock('expo-file-system')

// Stub the expo-file-system File class so new File(uri).arrayBuffer() is controllable.
let mockArrayBuffer: () => Promise<ArrayBuffer>

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({
    arrayBuffer: () => mockArrayBuffer(),
  })),
}))

const storageFrom = supabase.storage.from as jest.Mock
const dbFrom = supabase.from as jest.Mock
const getSession = supabase.auth.getSession as jest.Mock

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

function makeStorageMock({
  uploadError = null,
  removeError = null,
}: {
  uploadError?: Error | null
  removeError?: Error | null
} = {}) {
  return {
    upload: jest
      .fn()
      .mockResolvedValue({ data: { path: 'trip1/123-456.pdf' }, error: uploadError }),
    createSignedUrl: jest.fn().mockResolvedValue({
      data: { signedUrl: 'https://cdn.example.com/signed' },
      error: null,
    }),
    remove: jest.fn().mockResolvedValue({ data: null, error: removeError }),
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockArrayBuffer = () => Promise.resolve(new ArrayBuffer(8))
})

// ---------------------------------------------------------------------------
// uploadDocument
// ---------------------------------------------------------------------------

describe('uploadDocument', () => {
  it('uploads the file and inserts the metadata row', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const storage = makeStorageMock()
    storageFrom.mockReturnValue(storage)
    const builder = makeQueryBuilder({ data: doc, error: null })
    dbFrom.mockReturnValue(builder)

    await expect(uploadDocument(uploadInput)).resolves.toEqual(doc)

    expect(storageFrom).toHaveBeenCalledWith('trip-documents')
    expect(storage.upload).toHaveBeenCalled()
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        trip_id: 'trip1',
        event_id: 'ev1',
        owner_id: 'u1',
        kind: 'document',
        name: 'invoice.pdf',
      }),
    )
  })

  it('throws when there is no session', async () => {
    getSession.mockResolvedValue({ data: { session: null } })

    await expect(uploadDocument(uploadInput)).rejects.toThrow('signed in')
    expect(storageFrom).not.toHaveBeenCalled()
  })

  it('throws when the file is 0 bytes', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    mockArrayBuffer = () => Promise.resolve(new ArrayBuffer(0))

    await expect(uploadDocument(uploadInput)).rejects.toThrow('empty')
    expect(storageFrom).not.toHaveBeenCalled()
  })

  it('throws when storage upload fails', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const storage = makeStorageMock({ uploadError: new Error('storage error') })
    storageFrom.mockReturnValue(storage)

    await expect(uploadDocument(uploadInput)).rejects.toThrow('storage error')
    expect(dbFrom).not.toHaveBeenCalled()
  })

  it('removes the orphaned object when the metadata insert fails', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const storage = makeStorageMock()
    storageFrom.mockReturnValue(storage)
    const builder = makeQueryBuilder({ data: null, error: makePostgrestError('insert fail') })
    dbFrom.mockReturnValue(builder)

    await expect(uploadDocument(uploadInput)).rejects.toThrow('insert fail')
    expect(storage.remove).toHaveBeenCalledWith([expect.stringMatching(/^trip1\//)])
  })

  it('uses application/pdf as fallback when mimeType is empty', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const storage = makeStorageMock()
    storageFrom.mockReturnValue(storage)
    const builder = makeQueryBuilder({ data: doc, error: null })
    dbFrom.mockReturnValue(builder)

    await uploadDocument({ ...uploadInput, mimeType: '' })

    expect(storage.upload).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(ArrayBuffer),
      expect.objectContaining({ contentType: 'application/pdf' }),
    )
  })
})

// ---------------------------------------------------------------------------
// listEventDocuments
// ---------------------------------------------------------------------------

describe('listEventDocuments', () => {
  it('returns documents ordered by creation date', async () => {
    const builder = makeQueryBuilder({ data: [doc], error: null })
    dbFrom.mockReturnValue(builder)

    await expect(listEventDocuments('ev1')).resolves.toEqual([doc])
    expect(dbFrom).toHaveBeenCalledWith('media')
    expect(builder.eq).toHaveBeenCalledWith('event_id', 'ev1')
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('throws on query error', async () => {
    dbFrom.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('list fail') }))

    await expect(listEventDocuments('ev1')).rejects.toThrow('list fail')
  })
})

// ---------------------------------------------------------------------------
// listTripDocuments
// ---------------------------------------------------------------------------

describe('listTripDocuments', () => {
  it('returns every trip document ordered by creation date', async () => {
    const builder = makeQueryBuilder({ data: [doc], error: null })
    dbFrom.mockReturnValue(builder)

    await expect(listTripDocuments('trip1')).resolves.toEqual([doc])
    expect(dbFrom).toHaveBeenCalledWith('media')
    // Pin both filters and their order so the kind='document' scope cannot silently regress.
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'trip_id', 'trip1')
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'kind', 'document')
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('throws on query error', async () => {
    dbFrom.mockReturnValue(
      makeQueryBuilder({ data: null, error: makePostgrestError('trip list fail') }),
    )

    await expect(listTripDocuments('trip1')).rejects.toThrow('trip list fail')
  })
})

// ---------------------------------------------------------------------------
// getDocumentUrl
// ---------------------------------------------------------------------------

describe('getDocumentUrl', () => {
  it('returns the signed URL', async () => {
    const storage = makeStorageMock()
    storageFrom.mockReturnValue(storage)

    await expect(getDocumentUrl('trip1/file.pdf')).resolves.toBe('https://cdn.example.com/signed')
    expect(storage.createSignedUrl).toHaveBeenCalledWith('trip1/file.pdf', 3600)
  })

  it('throws when createSignedUrl errors', async () => {
    storageFrom.mockReturnValue({
      createSignedUrl: jest
        .fn()
        .mockResolvedValue({ data: null, error: new Error('signed url error') }),
    })

    await expect(getDocumentUrl('trip1/file.pdf')).rejects.toThrow('signed url error')
  })
})

// ---------------------------------------------------------------------------
// deleteDocument
// ---------------------------------------------------------------------------

describe('deleteDocument', () => {
  it('removes the storage object then deletes the row', async () => {
    const storage = makeStorageMock()
    storageFrom.mockReturnValue(storage)
    const builder = makeQueryBuilder({ data: null, error: null })
    dbFrom.mockReturnValue(builder)

    await expect(deleteDocument(doc)).resolves.toBeUndefined()

    expect(storage.remove).toHaveBeenCalledWith([doc.storage_path])
    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('id', doc.id)
  })

  it('throws when storage remove fails', async () => {
    const storage = makeStorageMock({ removeError: new Error('remove fail') })
    storageFrom.mockReturnValue(storage)

    await expect(deleteDocument(doc)).rejects.toThrow('remove fail')
    expect(dbFrom).not.toHaveBeenCalled()
  })

  it('throws when the row delete fails', async () => {
    const storage = makeStorageMock()
    storageFrom.mockReturnValue(storage)
    dbFrom.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('row fail') }))

    await expect(deleteDocument(doc)).rejects.toThrow('row fail')
  })
})
