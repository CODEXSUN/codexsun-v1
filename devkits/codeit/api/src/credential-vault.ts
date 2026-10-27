import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const VERSION = "v1";

export function encryptSecret(secret: string, passphrase: string): string {
  if (passphrase.length < 16) throw new Error("The credential passphrase must contain at least 16 characters.");
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  key.fill(0);
  return [VERSION, salt.toString("base64"), iv.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptSecret(value: string, passphrase: string): string {
  const [version, salt, iv, tag, ciphertext] = value.split(":");
  if (version !== VERSION || !salt || !iv || !tag || !ciphertext) throw new Error("Invalid encrypted credential.");
  const key = scryptSync(passphrase, Buffer.from(salt, "base64"), 32);
  try {
    const cipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
    cipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([cipher.update(Buffer.from(ciphertext, "base64")), cipher.final()]).toString("utf8");
  } finally {
    key.fill(0);
  }
}
