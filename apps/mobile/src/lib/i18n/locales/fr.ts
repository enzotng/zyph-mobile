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
  trip: {
    manage: 'Gérer',
    owed: 'On te doit',
    owe: 'Tu dois',
    settled: 'Comptes équilibrés',
    owedSub: "{{names}} te doivent de l'argent.",
    oweSub: 'Règle ta part quand tu veux.',
    settledSub: 'Tout le monde est à jour.',
    settle: 'Régler les comptes',
    viewBalances: 'Voir les soldes',
    upcoming: 'À venir',
    recent: 'Dépenses récentes',
    viewAll: 'Voir tout',
    paidBy: 'Payé par {{name}}',
    scan: 'Scanner',
    expense: 'Dépense',
    map: 'Carte',
    ar: 'AR',
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
