// English UI strings. Source-of-truth keys; `fr.ts` mirrors this shape.
// Voice: plain, calm, second-person, action-first. Sentence case everywhere.
export const en = {
  common: {
    add: 'Add',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    done: 'Done',
    back: 'Back',
    retry: 'Try again',
    loading: 'Loading…',
    saving: 'Saving…',
    perPerson: 'Per person',
  },
  trips: {
    title: 'My trips',
    create: 'Create a trip',
    join: 'Join by code',
    empty: {
      title: 'No trips yet',
      body: 'Create your first trip to get started.',
    },
    error: 'Could not load your trips.',
  },
  tabs: {
    trips: 'Trips',
    profile: 'Profile',
    overview: 'Overview',
    timeline: 'Timeline',
    expenses: 'Expenses',
    places: 'Places',
  },
  expenses: {
    settleUp: 'Settle up',
  },
}

// Structural shape (string leaves) so locale files match keys, not exact English text.
export type Translations = typeof en
