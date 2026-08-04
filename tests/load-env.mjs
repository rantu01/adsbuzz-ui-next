// Runs before every test file (via --import register). Loads MONGODB_URI from
// .env.local and redirects ALL tests to an isolated `adsbuzz_test` database so
// production collections are never touched.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

register("./alias-loader.mjs", import.meta.url);

function loadEnvFile() {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const env = {};
  for (const raw of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^"|"$/g, "");
    if (key) env[key] = value;
  }
  return env;
}

const fileEnv = loadEnvFile();

// Force an isolated test database so production collections are never touched.
process.env.MONGODB_URI = process.env.MONGODB_URI || fileEnv.MONGODB_URI || "";
process.env.MONGODB_DB_NAME = "adsbuzz_test";

export default {};
