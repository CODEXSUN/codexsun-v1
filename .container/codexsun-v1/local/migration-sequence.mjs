export async function prepareDatabase(steps, markDatabaseChangesPossible) {
  await steps.guard();
  if (steps.startupProof) {
    await steps.preliminaryBackup();
    await steps.guard();
    markDatabaseChangesPossible();
    await steps.startupProof();
    await steps.guard();
  }
  await steps.backup();
  await steps.guard();
  await steps.preflight();
  await steps.verify();
  await steps.guard();
  markDatabaseChangesPossible();
  await steps.migrate();
  await steps.guard();
  await steps.seed();
  await steps.guard();
}

export async function withMigrationRecovery(work, recoverBeforeMigration, recoverAfterMigration) {
  let databaseChangesPossible = false;
  try {
    return await work(() => {
      databaseChangesPossible = true;
    });
  } catch (error) {
    await (databaseChangesPossible ? recoverAfterMigration() : recoverBeforeMigration());
    throw error;
  }
}
