import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const resources = JSON.parse(await readFile(path.join(root, "data", "google-drive-resources.json"), "utf8"));
const resourceDir = path.join(root, "public", "resources");

for (const filename of await readdir(resourceDir)) {
  if (!/^index-[^.]+\.html$/.test(filename)) continue;
  const filePath = path.join(resourceDir, filename);
  const html = await readFile(filePath, "utf8");
  let updated = html.replace(/href="([^"]+\.pdf)"/g, (match, pdf) => {
    const id = resources.files[pdf];
    if (!id) throw new Error(`Missing Google Drive id for ${pdf}`);
    return `href="https://drive.usercontent.google.com/download?id=${id}&amp;export=download&amp;confirm=t"`;
  });
  updated = updated.replace(
    /href="https:\/\/drive\.google\.com\/file\/d\/([^/]+)\/view"/g,
    'href="https://drive.usercontent.google.com/download?id=$1&amp;export=download&amp;confirm=t"',
  );
  await writeFile(filePath, updated, "utf8");
}

console.log(`Synchronized ${Object.keys(resources.files).length} Google Drive PDF links.`);
