import type { Translations } from './en'

// Microcopie française. Voix simple, calme, à la deuxième personne, orientée action.
// Sentence case partout. Jamais de tiret cadratin/demi-cadratin, uniquement "-".
export const fr: Translations = {
  common: {
    add: 'Ajouter',
    save: 'Enregistrer',
    cancel: 'Annuler',
    delete: 'Supprimer',
    edit: 'Modifier',
    done: 'Terminer',
    back: 'Retour',
    retry: 'Réessayer',
    loading: 'Chargement…',
    saving: 'Enregistrement…',
    perPerson: 'Par personne',
  },
  trips: {
    title: 'Mes voyages',
    create: 'Créer un voyage',
    join: 'Rejoindre par code',
    empty: {
      title: 'Aucun voyage pour le moment',
      body: 'Créez votre premier voyage pour commencer.',
    },
    error: 'Impossible de charger vos voyages.',
    errorTitle: 'Connexion perdue',
    add: 'Nouveau voyage',
    owed: 'On te doit {{amount}}',
    owe: 'Tu dois {{amount}}',
    settled: 'Comptes équilibrés',
  },
  tabs: {
    trips: 'Voyages',
    profile: 'Profil',
    overview: 'Aperçu',
    timeline: 'Timeline',
    expenses: 'Dépenses',
    places: 'Repères',
  },
  expenses: {
    settleUp: 'Régler',
  },
}
