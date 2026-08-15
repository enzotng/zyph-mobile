// Push-copy rendering, one line per notification type. No Deno-only APIs, so - exactly like
// lang.ts - this module is unit-tested directly from the app's jest runner (see copy.test.ts,
// discovered via the `roots` entry in apps/mobile/jest.config.js) without a Deno shim.

import type { Lang } from './lang.ts'

export type Payload = Record<string, unknown>

// Characters that render as nothing, or reorder what follows. None of them are whitespace to
// String.trim, so a name built only from them would survive a plain emptiness test and put an
// actor on the lock screen that names no one. Mirrors private.clean_name, which strips them at the
// source; this pass covers rows written before it existed. Kept in sync with the app's schemas.ts.
// deno-lint-ignore no-control-regex
const INVISIBLE =
  // biome-ignore lint/suspicious/noControlCharactersInRegex: removing them is the point
  /[\u0001-\u0008\u000E-\u001F\u007F-\u0084\u0086-\u009F\u00AD\u034F\u061C\u17B4-\u17B5\u180B-\u180E\u200B\u200E-\u200F\u202A-\u202E\u2060-\u2069\uFEFF\u{E0000}-\u{E007F}]/gu
// Blank but space-occupying, or an outright line break: whitespace to neither Postgres btrim nor
// String.trim. Mapped to a space rather than dropped, so a name that used one as a word break
// keeps it - and so U+2028 cannot end the line inside a one-line notification row.
const BLANK = /[\u0009-\u000D\u0085\u00A0\u115F-\u1160\u1680\u2000-\u200A\u2028-\u2029\u202F\u205F\u2800\u3000\u3164\uFFA0]/gu
// A name has to name someone. Enumerating invisible codepoints is a race against Unicode we lose;
// requiring that something which actually paints survives closes the class, including codepoints
// not yet assigned. Free text (an expense description, an event title) deliberately skips this.
const LEGIBLE = /[\p{L}\p{N}\p{S}]/u

export function str(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const cleaned = value.replace(INVISIBLE, '').replace(BLANK, ' ').replace(/ +/g, ' ').trim()
  return cleaned.length > 0 ? cleaned : null
}

// Same legibility gate as private.clean_name, for the fields that name a person. str() stays
// unguarded because it also carries free text and ids.
function nameOf(value: unknown): string | null {
  const cleaned = str(value)
  return cleaned !== null && LEGIBLE.test(cleaned) ? cleaned : null
}

// Wording of notifications.someone in apps/mobile/src/lib/i18n: rows written before the member.*
// payloads became nominative carry no actorName at all.
function actorOf(payload: Payload, en: boolean): string {
  return nameOf(payload.actorName) ?? (en ? 'Someone' : 'Quelqu’un')
}

// The detached account receives member.detached like the rest of the group, but RLS hides the trip
// from it the moment the row is written, so the third-person line points it at nothing. Same test
// as isDetachedRecipient in apps/mobile/src/features/notifications/schemas.ts, recipient guard
// included: without it two absent ids compare equal and the whole group reads the first-person line.
function isDetachedSelf(payload: Payload, recipientId: string | null): boolean {
  return !!recipientId && str(payload.detachedUserId) === recipientId
}

// Localized push copy per notification type, mirroring the in-app feed. settlement.created splits
// on the payload role (payer vs payee) and member.detached on the recipient. Falls back to a
// generic line for any unknown type.
//
// The member.* lines name the actor FIRST: a lock screen truncates the tail, and who acted is the
// group's only detection defence against a wrong claim (spec D2).
export function pushCopy(
  type: string,
  payload: Payload,
  lang: Lang,
  recipientId: string | null,
): { title: string; body: string } {
  const description = str(payload.description)
  const title = str(payload.title)
  const en = lang === 'en'
  switch (type) {
    // Named like the rest: this is the branch someone entering off a shared link actually takes,
    // so leaving it anonymous would leave the one path that matters uncovered (spec D2).
    case 'member.joined': {
      const actor = actorOf(payload, en)
      return {
        title: 'ZYPH',
        body: en ? `${actor} joined the trip` : `${actor} a rejoint le voyage`,
      }
    }
    case 'member.left':
      return { title: 'ZYPH', body: en ? 'A member left the trip' : 'Un membre a quitté le voyage' }
    case 'member.removed':
      return {
        title: 'ZYPH',
        body: en ? 'You were removed from a trip' : 'Tu as été retiré d’un voyage',
      }
    case 'member.added': {
      const actor = actorOf(payload, en)
      const name = nameOf(payload.name)
      if (!name) {
        return {
          title: 'ZYPH',
          body: en ? `${actor} added a participant` : `${actor} a ajouté un participant`,
        }
      }
      return { title: 'ZYPH', body: en ? `${actor} added ${name}` : `${actor} a ajouté ${name}` }
    }
    case 'member.claimed': {
      const actor = actorOf(payload, en)
      const name = nameOf(payload.slotName)
      if (!name) {
        return {
          title: 'ZYPH',
          body: en ? `${actor} joined the trip` : `${actor} a rejoint le voyage`,
        }
      }
      return {
        title: 'ZYPH',
        body: en ? `${actor} joined as ${name}` : `${actor} a rejoint en tant que ${name}`,
      }
    }
    case 'member.renamed': {
      const actor = actorOf(payload, en)
      const oldName = nameOf(payload.oldName)
      const newName = nameOf(payload.newName)
      if (!oldName || !newName) {
        return {
          title: 'ZYPH',
          body: en ? `${actor} renamed a participant` : `${actor} a renommé un participant`,
        }
      }
      return {
        title: 'ZYPH',
        body: en
          ? `${actor} renamed ${oldName} to ${newName}`
          : `${actor} a renommé ${oldName} en ${newName}`,
      }
    }
    case 'member.detached': {
      const actor = actorOf(payload, en)
      // The person losing the place is the one with the most reason to know who took it away.
      if (isDetachedSelf(payload, recipientId)) {
        return {
          title: 'ZYPH',
          body: en ? `${actor} released your spot` : `${actor} a libéré ta place`,
        }
      }
      const name = nameOf(payload.name)
      if (!name) {
        return {
          title: 'ZYPH',
          body: en ? `${actor} released a spot` : `${actor} a libéré une place`,
        }
      }
      return {
        title: 'ZYPH',
        body: en ? `${actor} released ${name}’s spot` : `${actor} a libéré la place de ${name}`,
      }
    }
    case 'expense.added':
      return {
        title: en ? 'New expense' : 'Nouvelle dépense',
        body: description ?? (en ? 'An expense was added' : 'Une dépense a été ajoutée'),
      }
    case 'expense.updated':
      return {
        title: en ? 'Expense updated' : 'Dépense modifiée',
        body: description ?? (en ? 'An expense was updated' : 'Une dépense a été mise à jour'),
      }
    case 'settlement.created':
      return payload.role === 'to'
        ? { title: 'ZYPH', body: en ? 'You received a payment' : 'Tu as reçu un paiement' }
        : { title: 'ZYPH', body: en ? 'Your payment was recorded' : 'Ton paiement a été enregistré' }
    case 'settlement.reversed':
      return { title: 'ZYPH', body: en ? 'A payment was reversed' : 'Un paiement a été annulé' }
    case 'event.added':
      return {
        title: en ? 'New event' : 'Nouvel événement',
        body: title ?? (en ? 'An event was added' : 'Un événement a été ajouté'),
      }
    case 'packing.assigned':
      return {
        title: en ? 'Packing' : 'Bagages',
        body: en ? 'A packing item was assigned to you' : 'Un article de bagage t’a été attribué',
      }
    case 'packing.nudged':
      return {
        title: en ? 'Packing' : 'Bagages',
        body: en ? 'Reminder: an item to prepare' : 'Rappel : un article à préparer',
      }
    case 'packing.reminder':
      return {
        title: en ? 'Packing' : 'Bagages',
        body: en
          ? 'Remember to prepare the shared trip gear'
          : 'Pense à préparer le matériel partagé du voyage',
      }
    default:
      return { title: 'ZYPH', body: en ? 'New activity' : 'Nouvelle activité' }
  }
}
