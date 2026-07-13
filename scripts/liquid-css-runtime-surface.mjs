import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const route = process.argv[2] ?? "thread-list";
const mode = process.argv[3] ?? "baseline";
const candidateRoot = process.env.LIQUID_GLASS_CANDIDATE_ROOT ?? "dist-candidate/themes/liquid-glass";

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function baselineCss() {
  return read("dist/themes/liquid-glass/index.css");
}

function splitCss(routeName) {
  return [
    read(`${candidateRoot}/index.css`),
    read(`${candidateRoot}/routes/${routeName}.css`)
  ].join("\n");
}

process.stdout.write(mode === "split" ? splitCss(route) : baselineCss());
