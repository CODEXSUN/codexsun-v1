export function assertMasterProofConfiguration(
  sandbox: string,
  confirmation: string,
  nodeEnv: string
) {
  if (nodeEnv !== "production" || confirmation !== "BACKUP_MASTER_STARTUP")
    throw new Error("Master startup proof requires explicit production CLI confirmation.");
  if (!/^codexsun_master_proof_[a-f0-9]{16}$/u.test(sandbox))
    throw new Error("Master startup proof requires a unique generated sandbox name.");
}
