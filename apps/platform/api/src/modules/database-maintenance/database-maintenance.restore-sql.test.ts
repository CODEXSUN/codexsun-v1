import assert from "node:assert/strict";
import test from "node:test";
import { restoreCreateDatabaseSql } from "./database-maintenance.restore-sql.js";

test("unique proof sandboxes use strict creation and cannot silently reuse a database", () => {
  assert.match(
    restoreCreateDatabaseSql("codexsun_master_proof_0123456789abcdef", true),
    /^CREATE DATABASE `codexsun_master_proof_0123456789abcdef` /u
  );
  assert.match(
    restoreCreateDatabaseSql("existing_sandbox", false),
    /^CREATE DATABASE IF NOT EXISTS `existing_sandbox` /u
  );
  assert.throws(() => restoreCreateDatabaseSql("unsafe-name; DROP DATABASE master", true));
});
