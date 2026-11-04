// `output: "standalone"` puts a minimal server in .next/standalone but does not
// copy static assets. The Docker image copies them explicitly; this script does
// the same for local `npm run start` so both environments run identical code.
import { cp, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");

if (!existsSync(standalone)) {
  console.error("Standalone build not found. Run `npm run build` first.");
  process.exit(1);
}

const staticSource = path.join(root, ".next", "static");
const staticTarget = path.join(standalone, ".next", "static");
await mkdir(path.dirname(staticTarget), { recursive: true });
await cp(staticSource, staticTarget, { recursive: true, force: true });

const publicSource = path.join(root, "public");
if (existsSync(publicSource)) {
  await cp(publicSource, path.join(standalone, "public"), {
    recursive: true,
    force: true,
  });
}

const target = path.join(standalone, "server.js");
const info = await stat(target);
console.log(`Standalone server ready (${info.size} bytes): ${target}`);
