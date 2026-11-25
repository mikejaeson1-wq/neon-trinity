// Only the shared band catalog is cached. Callers check the room, TV pairing
// and personal grants for every request before exposing any part of it.
export function createCatalogReader() {
  let cached;
  let pending;
  async function load(db) {
    const row = async fields => {
      const result = await db.from('nt_catalog').select(fields).eq('id', 1).single();
      if (result.error || !result.data) throw Object.assign(new Error('Die Band-Mediathek ist gerade nicht erreichbar.'), {status: 500});
      return result.data;
    };
    if (Number.isSafeInteger(cached?.revision)) {
      const {revision} = await row('revision');
      if (revision === cached.revision) return cached.data;
    }
    cached = await row('data,revision');
    return cached.data;
  }
  return db => {
    if (!pending) pending = load(db).finally(() => { pending = null; });
    return pending;
  };
}
