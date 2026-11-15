// Bundles guides/*.json into one module so serverless builds always ship the library.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
const files = readdirSync("guides").filter((f) => f.endsWith(".json")).sort();
const guides = files.map((f) => JSON.parse(readFileSync(`guides/${f}`, "utf8")));
writeFileSync("src/lib/curated.generated.json", JSON.stringify(guides));
console.log(`bundled ${guides.length} guides`);
