// Unit tests exercise pure rules, never the database. Importing a module that
// also talks to Prisma must not require a live DATABASE_URL, so `db` is stubbed.
// Any test that genuinely needs data belongs in an integration test instead.
export const db = new Proxy({} as Record<string, unknown>, {
  get() {
    throw new Error("The database is not available in unit tests – write an integration test instead.");
  },
});
