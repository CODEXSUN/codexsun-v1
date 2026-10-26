import {createReadStream} from 'node:fs';
import {createDecipheriv,createHash} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {Writable} from 'node:stream';
import {createGunzip} from 'node:zlib';
import {StringDecoder} from 'node:string_decoder';
const magic=Buffer.from('CODEXSUN-AES256-GCM-1\n');
export async function decryptBackupTo(file, key, identity, output) {
  const { open } = await import('node:fs/promises');
  const handle = await open(file, 'r');
  let header, nonce, tag, size;
  try {
    size = (await handle.stat()).size;
    const prefix = Buffer.alloc(magic.length + 4);
    await handle.read(prefix, 0, prefix.length, 0);
    if (!prefix.subarray(0, magic.length).equals(magic)) throw new Error('Invalid encrypted backup format');
    const aadLength = prefix.readUInt32BE(magic.length);
    if (aadLength > 8192 || size <= prefix.length + aadLength + 28) throw new Error('Invalid backup header size');
    header = Buffer.alloc(prefix.length + aadLength + 12);
    await handle.read(header, 0, header.length, 0);
    const aad = header.subarray(prefix.length, prefix.length + aadLength);
    if (aad.toString() !== JSON.stringify(identity)) throw new Error('Backup scope binding differs');
    nonce = header.subarray(-12); tag = Buffer.alloc(16);
    await handle.read(tag, 0, 16, size - 16);
  } finally { await handle.close(); }
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAAD(header); decipher.setAuthTag(tag);
  await pipeline(createReadStream(file, { start: header.length, end: size - 17 }), decipher, createGunzip(), output);
}

export async function verifyEncrypted(file, key, identity, expectedTables) {
  const inspector = new IntegrityInspector(identity.database, expectedTables);
  await decryptBackupTo(file, key, identity, inspector);
  return inspector.result();
}

class IntegrityInspector extends Writable {
  constructor(database, tables) {
    super(); this.database = database; this.expected = tables; this.hash = createHash('sha256');
    this.decoder = new StringDecoder('utf8'); this.prefix = ''; this.tail = Buffer.alloc(0);
    this.databases = new Set(); this.tables = new Set(); this.bytes = 0; this.json = [];
    this.mode = Array.isArray(tables) ? 'sql' : tables?.archive ? 'archive' : 'json';
  }
  _write(chunk, _encoding, done) {
    this.hash.update(chunk); this.bytes += chunk.length;
    this.tail = Buffer.concat([this.tail, chunk]).subarray(-8192);
    if (this.mode === 'json') {
      if (this.bytes > 16 * 1024 * 1024) return done(new Error('Configuration exceeds review limit'));
      this.json.push(chunk);
    } else if (this.mode === 'sql') {
      const lines = this.decoder.write(chunk).split('\n');
      for (let index = 0; index < lines.length; index++) {
        this.prefix += lines[index].slice(0, Math.max(0, 4096 - this.prefix.length));
        if (index < lines.length - 1) { this.line(this.prefix); this.prefix = ''; }
      }
    }
    done();
  }
  line(value) {
    const use = /^\s*USE `([A-Za-z0-9_]+)`;/.exec(value);
    if (use) this.databases.add(use[1]);
    const table = /^CREATE TABLE(?: IF NOT EXISTS)? `([^`]+)`/.exec(value);
    if (table) this.tables.add(table[1]);
  }
  result() {
    if (this.mode === 'sql') {
      this.line(this.prefix + this.decoder.end());
      if (this.databases.size !== 1 || !this.databases.has(this.database) ||
        !this.tail.includes(Buffer.from('-- Dump completed')) ||
        this.expected.some(name => !this.tables.has(name))) throw new Error('SQL scope, completion, or table definition verification failed');
    } else if (this.mode === 'json') {
      const parsed = JSON.parse(Buffer.concat(this.json).toString('utf8'));
      if (!Array.isArray(parsed) || parsed.length !== 3 ||
        new Set(parsed.map(row => row.Name)).size !== 3 ||
        parsed.some(row => !['/codexsun-api','/codexsun-web','/codexsun-shop'].includes(row.Name))) throw new Error('Configuration scope differs');
    }
    return { aesAuthenticationVerified: true, gzipIntegrityVerified: true, plaintextBytes: this.bytes,
      plaintextSha256: this.hash.digest('hex'), databaseDirectives: [...this.databases],
      tableDefinitionsVerified: this.mode === 'sql' ? this.expected.length : null,
      archivePayload: this.mode === 'archive', noSqlExecuted: true, restoreTestPerformed: false };
  }
}
