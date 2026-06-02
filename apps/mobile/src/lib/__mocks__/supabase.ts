// Manual Jest mock for the Supabase client. Activated with jest.mock('@/lib/supabase').
// Tests configure return values per call, e.g.
//   (supabase.from as jest.Mock).mockReturnValue(makeQueryBuilder({ data, error: null }))
// Replacing the whole module also avoids the AppState side-effect in the real file.

export const supabase = {
  from: jest.fn(),
  rpc: jest.fn(),
  auth: {
    getSession: jest.fn(),
    getUser: jest.fn(),
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
  },
  storage: {
    from: jest.fn(),
  },
  functions: {
    invoke: jest.fn(),
  },
}
