#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { HostingerSshService } from "./hostinger-ssh.service.mjs";

const action = process.argv[2];
if (action !== "status") {
  console.error(
    "Usage: npm run hostinger:status. Deployments use root setup.sh and update.sh on the VPS."
  );
  process.exitCode = 64;
} else {
  try {
    const target = JSON.parse(await readFile(new URL("../target.json", import.meta.url), "utf8"));
    const service = new HostingerSshService(target);
    const result = await service.status();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(
      `Hostinger SSH status failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exitCode = 1;
  }
}
