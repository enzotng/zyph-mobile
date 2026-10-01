import { type Payload, pushCopy, str } from './copy'

const enCopy = (type: string, payload: Payload = {}, recipientId: string | null = null) =>
  pushCopy(type, payload, 'en', recipientId)
const frCopy = (type: string, payload: Payload = {}, recipientId: string | null = null) =>
  pushCopy(type, payload, 'fr', recipientId)

// The entry path someone holding a shared link actually takes. It stayed anonymous while every
// other member.* line named its actor, which left the one route that matters uncovered (spec D2).
describe('pushCopy - member.joined', () => {
  it('names whoever came in', () => {
    expect(enCopy('member.joined', { actorName: 'Marco' })).toEqual({
      title: 'ZYPH',
      body: 'Marco joined the trip',
    })
    expect(frCopy('member.joined', { actorName: 'Marco' })).toEqual({
      title: 'ZYPH',
      body: 'Marco a rejoint le voyage',
    })
  })

  it('falls back to the anonymous actor on a payload written before actorName', () => {
    expect(enCopy('member.joined').body).toBe('Someone joined the trip')
    expect(frCopy('member.joined').body).toBe('Quelqu’un a rejoint le voyage')
  })
})

describe('pushCopy - member.added', () => {
  it('names the actor first, then the place', () => {
    expect(enCopy('member.added', { actorName: 'Marco', name: 'Léa' })).toEqual({
      title: 'ZYPH',
      body: 'Marco added Léa',
    })
    expect(frCopy('member.added', { actorName: 'Marco', name: 'Léa' })).toEqual({
      title: 'ZYPH',
      body: 'Marco a ajouté Léa',
    })
  })

  it('falls back to the anonymous actor when the payload predates actorName', () => {
    expect(enCopy('member.added', { name: 'Léa' }).body).toBe('Someone added Léa')
    expect(frCopy('member.added', { name: 'Léa' }).body).toBe('Quelqu’un a ajouté Léa')
    expect(enCopy('member.added', { actorName: null, name: 'Léa' }).body).toBe('Someone added Léa')
    expect(enCopy('member.added', { actorName: '   ', name: 'Léa' }).body).toBe('Someone added Léa')
  })

  it('drops the place name rather than rendering an empty one', () => {
    expect(enCopy('member.added', { actorName: 'Marco' }).body).toBe('Marco added a participant')
    expect(frCopy('member.added', { actorName: 'Marco' }).body).toBe('Marco a ajouté un participant')
  })
})

describe('pushCopy - member.claimed', () => {
  it('names the actor first, then the place they took', () => {
    expect(enCopy('member.claimed', { actorName: 'Marco', slotName: 'Léa' })).toEqual({
      title: 'ZYPH',
      body: 'Marco joined as Léa',
    })
    expect(frCopy('member.claimed', { actorName: 'Marco', slotName: 'Léa' })).toEqual({
      title: 'ZYPH',
      body: 'Marco a rejoint en tant que Léa',
    })
  })

  it('falls back to the anonymous actor', () => {
    expect(enCopy('member.claimed', { slotName: 'Léa' }).body).toBe('Someone joined as Léa')
    expect(frCopy('member.claimed', { slotName: 'Léa' }).body).toBe(
      'Quelqu’un a rejoint en tant que Léa',
    )
  })

  it('drops the place name rather than rendering an empty one', () => {
    expect(enCopy('member.claimed', { actorName: 'Marco' }).body).toBe('Marco joined the trip')
    expect(frCopy('member.claimed', { actorName: 'Marco' }).body).toBe('Marco a rejoint le voyage')
  })
})

describe('pushCopy - member.renamed', () => {
  it('names the actor first, then both sides of the rename', () => {
    expect(enCopy('member.renamed', { actorName: 'Marco', oldName: 'Léa', newName: 'Léo' })).toEqual(
      { title: 'ZYPH', body: 'Marco renamed Léa to Léo' },
    )
    expect(frCopy('member.renamed', { actorName: 'Marco', oldName: 'Léa', newName: 'Léo' })).toEqual(
      { title: 'ZYPH', body: 'Marco a renommé Léa en Léo' },
    )
  })

  it('falls back to the anonymous actor', () => {
    expect(enCopy('member.renamed', { oldName: 'Léa', newName: 'Léo' }).body).toBe(
      'Someone renamed Léa to Léo',
    )
    expect(frCopy('member.renamed', { oldName: 'Léa', newName: 'Léo' }).body).toBe(
      'Quelqu’un a renommé Léa en Léo',
    )
  })

  it('drops both names when either side is missing', () => {
    expect(enCopy('member.renamed', { actorName: 'Marco', newName: 'Léo' }).body).toBe(
      'Marco renamed a participant',
    )
    expect(frCopy('member.renamed', { actorName: 'Marco', oldName: 'Léa' }).body).toBe(
      'Marco a renommé un participant',
    )
  })
})

describe('pushCopy - member.detached', () => {
  it('tells the group who released which place', () => {
    const payload = { actorName: 'Marco', name: 'Léa', detachedUserId: 'u1' }
    expect(pushCopy('member.detached', payload, 'en', 'u2')).toEqual({
      title: 'ZYPH',
      body: 'Marco released Léa’s spot',
    })
    expect(pushCopy('member.detached', payload, 'fr', 'u2')).toEqual({
      title: 'ZYPH',
      body: 'Marco a libéré la place de Léa',
    })
  })

  // The detached account is a recipient like the rest of the group, but the trip it names is
  // already hidden from it by RLS - the third-person line would point it at nothing.
  it('addresses the detached account itself, and still names who acted', () => {
    const payload = { actorName: 'Marco', name: 'Léa', detachedUserId: 'u1' }
    expect(pushCopy('member.detached', payload, 'en', 'u1')).toEqual({
      title: 'ZYPH',
      body: 'Marco released your spot',
    })
    expect(pushCopy('member.detached', payload, 'fr', 'u1')).toEqual({
      title: 'ZYPH',
      body: 'Marco a libéré ta place',
    })
  })

  it('keeps the third-person line when the recipient cannot be identified', () => {
    const payload = { actorName: 'Marco', name: 'Léa' }
    expect(pushCopy('member.detached', payload, 'en', null).body).toBe('Marco released Léa’s spot')
    expect(pushCopy('member.detached', { ...payload, detachedUserId: 'u1' }, 'en', null).body).toBe(
      'Marco released Léa’s spot',
    )
  })

  it('falls back to the anonymous actor', () => {
    expect(enCopy('member.detached', { name: 'Léa' }).body).toBe('Someone released Léa’s spot')
    expect(frCopy('member.detached', { name: 'Léa' }).body).toBe(
      'Quelqu’un a libéré la place de Léa',
    )
  })

  it('drops the place name rather than rendering an empty one', () => {
    expect(enCopy('member.detached', { actorName: 'Marco' }).body).toBe('Marco released a spot')
    expect(frCopy('member.detached', { actorName: 'Marco' }).body).toBe('Marco a libéré une place')
  })
})

// Every type below shipped before the member.* copy existed: these literals are what devices
// already receive, so a diff here is a regression, never a new expectation.
describe('pushCopy - types that shipped before', () => {
  it('renders the member lifecycle lines', () => {
    expect(enCopy('member.left')).toEqual({ title: 'ZYPH', body: 'A member left the trip' })
    expect(frCopy('member.left')).toEqual({ title: 'ZYPH', body: 'Un membre a quitté le voyage' })
    expect(enCopy('member.removed')).toEqual({
      title: 'ZYPH',
      body: 'You were removed from a trip',
    })
    expect(frCopy('member.removed')).toEqual({
      title: 'ZYPH',
      body: 'Tu as été retiré d’un voyage',
    })
  })

  it('renders the expense lines, with the description when there is one', () => {
    expect(enCopy('expense.added', { description: 'Dinner' })).toEqual({
      title: 'New expense',
      body: 'Dinner',
    })
    expect(frCopy('expense.added', { description: 'Dîner' })).toEqual({
      title: 'Nouvelle dépense',
      body: 'Dîner',
    })
    expect(enCopy('expense.added')).toEqual({
      title: 'New expense',
      body: 'An expense was added',
    })
    expect(frCopy('expense.added')).toEqual({
      title: 'Nouvelle dépense',
      body: 'Une dépense a été ajoutée',
    })
    expect(enCopy('expense.updated', { description: 'Dinner' })).toEqual({
      title: 'Expense updated',
      body: 'Dinner',
    })
    expect(enCopy('expense.updated')).toEqual({
      title: 'Expense updated',
      body: 'An expense was updated',
    })
    expect(frCopy('expense.updated')).toEqual({
      title: 'Dépense modifiée',
      body: 'Une dépense a été mise à jour',
    })
  })

  it('splits settlement.created on the payload role', () => {
    expect(enCopy('settlement.created', { role: 'to' })).toEqual({
      title: 'ZYPH',
      body: 'You received a payment',
    })
    expect(frCopy('settlement.created', { role: 'to' })).toEqual({
      title: 'ZYPH',
      body: 'Tu as reçu un paiement',
    })
    expect(enCopy('settlement.created', { role: 'from' })).toEqual({
      title: 'ZYPH',
      body: 'Your payment was recorded',
    })
    expect(frCopy('settlement.created', { role: 'from' })).toEqual({
      title: 'ZYPH',
      body: 'Ton paiement a été enregistré',
    })
    expect(enCopy('settlement.reversed')).toEqual({
      title: 'ZYPH',
      body: 'A payment was reversed',
    })
    expect(frCopy('settlement.reversed')).toEqual({
      title: 'ZYPH',
      body: 'Un paiement a été annulé',
    })
  })

  it('renders the event line, with the title when there is one', () => {
    expect(enCopy('event.added', { title: 'Museum' })).toEqual({
      title: 'New event',
      body: 'Museum',
    })
    expect(enCopy('event.added')).toEqual({ title: 'New event', body: 'An event was added' })
    expect(frCopy('event.added')).toEqual({
      title: 'Nouvel événement',
      body: 'Un événement a été ajouté',
    })
  })

  it('renders the packing lines', () => {
    expect(enCopy('packing.assigned')).toEqual({
      title: 'Packing',
      body: 'A packing item was assigned to you',
    })
    expect(frCopy('packing.assigned')).toEqual({
      title: 'Bagages',
      body: 'Un article de bagage t’a été attribué',
    })
    expect(enCopy('packing.nudged')).toEqual({
      title: 'Packing',
      body: 'Reminder: an item to prepare',
    })
    expect(frCopy('packing.nudged')).toEqual({
      title: 'Bagages',
      body: 'Rappel : un article à préparer',
    })
    expect(enCopy('packing.reminder')).toEqual({
      title: 'Packing',
      body: 'Remember to prepare the shared trip gear',
    })
    expect(frCopy('packing.reminder')).toEqual({
      title: 'Bagages',
      body: 'Pense à préparer le matériel partagé du voyage',
    })
  })

  it('falls back to a generic line for an unknown type', () => {
    expect(enCopy('trip.exploded')).toEqual({ title: 'ZYPH', body: 'New activity' })
    expect(frCopy('trip.exploded')).toEqual({ title: 'ZYPH', body: 'Nouvelle activité' })
  })
})

describe('str', () => {
  it('keeps a trimmed non-empty string and rejects everything else', () => {
    expect(str('  Léa  ')).toBe('Léa')
    expect(str('')).toBeNull()
    expect(str('   ')).toBeNull()
    expect(str(null)).toBeNull()
    expect(str(undefined)).toBeNull()
    expect(str(42)).toBeNull()
    expect(str({ toString: () => 'nope' })).toBeNull()
  })

  // None of these are whitespace to String.trim, so a bare emptiness test lets them through and
  // the lock screen shows a nominative line naming nobody. private.clean_name strips them at the
  // source; str() has to agree for rows written before it existed.
  it('treats a name built only from invisible characters as absent', () => {
    expect(str('\u200B')).toBeNull()
    expect(str('\uFEFF\u2060')).toBeNull()
    expect(str('\u202E\u2066')).toBeNull()
    expect(str(' \u00AD \u061C ')).toBeNull()
    expect(str('\u{E0020}\u{E007F}')).toBeNull()
  })

  it('strips invisible and control characters from a name that has real content', () => {
    expect(str('M\u200Barco')).toBe('Marco')
    expect(str('\u202EMarco')).toBe('Marco')
  })

  // A line break must not glue two words together, and must not survive into a push body where
  // U+2028 would end the line early and let the rest of the template disappear.
  it('turns a line break into a space rather than deleting it', () => {
    expect(str('Marco\nreleased a spot')).toBe('Marco released a spot')
    expect(str('Jean\tDupont')).toBe('Jean Dupont')
    expect(str('Marco\u2028L\u00E9a')).toBe('Marco L\u00E9a')
    expect(str('Dinner\r\nParis')).toBe('Dinner Paris')
  })

  // ZWNJ and ZWJ are deliberately NOT stripped: ZWNJ is orthographically required in Persian and
  // ZWJ holds emoji sequences together. A name made only of joiners is caught by the legibility
  // gate on the name path instead, which is what the fallback assertions below cover.
  it('preserves joiners inside a real name', () => {
    expect(str('mi\u200Cravam')).toBe('mi\u200Cravam')
    expect(str('\u{1F468}\u200D\u{1F469}\u200D\u{1F467}')).toBe(
      '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}',
    )
  })

  // These paint nothing but are whitespace to neither Postgres btrim nor String.trim, so they
  // slipped past the first version of this filter and rendered a nominative line naming nobody.
  it('treats a name built only from blank-rendering characters as absent', () => {
    expect(str('\u2800\u2800\u2800')).toBeNull()
    expect(str('\u3164\u3164')).toBeNull()
    expect(str('\uFFA0\u115F\u1160')).toBeNull()
    expect(str('\u00A0\u3000\u2000\u205F\u1680')).toBeNull()
  })

  it('keeps a blank-rendering character that separates two real words', () => {
    expect(str('Jean\u00A0Pierre')).toBe('Jean Pierre')
    expect(str('Marco\u2800Léa')).toBe('Marco Léa')
  })

  // str() keeps these - they are not blank - so only the legibility gate on the name path can
  // reject them. Without it a lock screen reads "... added ...", naming nobody.
  it('refuses a name that survives cleaning but names nobody', () => {
    expect(str('...')).toBe('...')
    expect(enCopy('member.added', { actorName: '...', name: 'Léa' }).body).toBe('Someone added Léa')
    expect(enCopy('member.added', { actorName: 'Marco', name: '---' }).body).toBe(
      'Marco added a participant',
    )
    expect(frCopy('member.claimed', { actorName: '!!!', slotName: 'Léa' }).body).toBe(
      'Quelqu’un a rejoint en tant que Léa',
    )
  })

  it('leaves the anonymous fallback in charge once nothing legible survives', () => {
    expect(enCopy('member.joined', { actorName: '\u200B' }).body).toBe('Someone joined the trip')
    expect(frCopy('member.claimed', { actorName: '\u200B', slotName: 'Léa' }).body).toBe(
      'Quelqu’un a rejoint en tant que Léa',
    )
  })
})
