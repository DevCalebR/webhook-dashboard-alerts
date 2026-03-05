import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = path.join(root, ".env.example");
const target = path.join(root, ".env.local");

if (!fs.existsSync(source)) {
  console.error("Missing .env.example");
  process.exit(1);
}

if (fs.existsSync(target)) {
  console.log(".env.local already exists. No changes made.");
  process.exit(0);
}

fs.copyFileSync(source, target);
console.log("Created .env.local from .env.example");
console.log("Update Clerk keys and secrets before running the app.");
