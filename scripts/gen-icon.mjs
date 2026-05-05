import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(join(__dirname, "icon.svg"), "utf8");

const resvg = new Resvg(svg, { width: 1024, height: 1024 });
const png = resvg.render().asPng();

const out = join(__dirname, "../src-tauri/icons/icon.png");
writeFileSync(out, png);
console.log("✓ icon.png written to src-tauri/icons/");
