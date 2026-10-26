type Contact = { name: string; primaryPhone?: string | null };

type Pending = () => Promise<void>;

type TenantLookups = {
  active: number;
  pending: Pending[];
  inFlight: Map<number, Promise<Contact | null>>;
};

export class EnquiryContactLookup {
  private readonly tenants = new Map<string, TenantLookups>();

  find(tenantDatabase: string, id: number, load: () => Promise<Contact | null>) {
    let lookups = this.tenants.get(tenantDatabase);
    if (!lookups) {
      lookups = { active: 0, pending: [], inFlight: new Map() };
      this.tenants.set(tenantDatabase, lookups);
    }
    const current = lookups.inFlight.get(id);
    if (current) return current;

    const state = lookups;
    const result = new Promise<Contact | null>((resolve, reject) => {
      state.pending.push(async () => {
        try {
          resolve(await load());
        } catch (error) {
          reject(error);
        } finally {
          state.active--;
          state.inFlight.delete(id);
          this.pump(tenantDatabase, state);
        }
      });
    });
    state.inFlight.set(id, result);
    this.pump(tenantDatabase, state);
    return result;
  }

  private pump(tenantDatabase: string, state: TenantLookups) {
    // Match Core's tenant pool so concurrent pages cannot flood its wait queue.
    while (state.active < 4 && state.pending.length > 0) {
      state.active++;
      void state.pending.shift()!();
    }
    if (state.active === 0 && state.pending.length === 0) {
      this.tenants.delete(tenantDatabase);
    }
  }
}
