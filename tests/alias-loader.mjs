import path from "node:path";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

const root = path.resolve(process.cwd(), "src");
const extensions = [".js", ".jsx", ".mjs", ".json"];
const nextServerStub = pathToFileURL(path.resolve(process.cwd(), "tests/stubs/next-server.mjs")).href;

function resolveFile(target) {
  if (existsSync(target) && (target.endsWith(".js") || target.endsWith(".jsx") || target.endsWith(".mjs") || target.endsWith(".json"))) {
    return target;
  }
  for (const ext of extensions) {
    const candidate = `${target}${ext}`;
    if (existsSync(candidate)) return candidate;
  }
  const indexJs = path.join(target, "index.js");
  if (existsSync(indexJs)) return indexJs;
  const indexJsx = path.join(target, "index.jsx");
  if (existsSync(indexJsx)) return indexJsx;
  return target;
}

export async function resolve(specifier, context, next) {
  if (specifier === "next/server" || specifier === "next/headers") {
    return { url: nextServerStub, shortCircuit: true };
  }
  if (specifier.startsWith("@/")) {
    const target = resolveFile(path.join(root, specifier.slice(2)));
    return { url: pathToFileURL(target).href, shortCircuit: true };
  }
  return next(specifier, context);
}
