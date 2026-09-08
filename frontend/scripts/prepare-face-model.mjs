/** Copy ONLY the face-detection network. No identity, demographic or expression models. */
import { createRequire } from "node:module";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const require = createRequire(import.meta.url);
const root = dirname(fileURLToPath(import.meta.url));
const pkg = dirname(require.resolve("@vladmandic/face-api/package.json"));
const target = resolve(root, "../public/models/face-detector");
await mkdir(target, { recursive: true });
const files = [
  "tiny_face_detector_model-weights_manifest.json",
  "tiny_face_detector_model.bin",
];
const hashes = {};
for (const file of files) {
  await copyFile(resolve(pkg, "model", file), resolve(target, file));
  hashes[file] = createHash("sha256")
    .update(await readFile(resolve(target, file)))
    .digest("hex");
}
await copyFile(resolve(pkg, "LICENSE"), resolve(target, "LICENSE.txt"));
await writeFile(
  resolve(target, "provenance.json"),
  JSON.stringify(
    {
      package: "@vladmandic/face-api",
      version: JSON.parse(await readFile(resolve(pkg, "package.json"))).version,
      source: "https://www.npmjs.com/package/@vladmandic/face-api",
      license: "MIT",
      purpose:
        "Face bounding boxes only. No identity matching or biometric templates.",
      sha256: hashes,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Prepared local Tiny Face Detector assets:",
  Object.keys(hashes).join(", "),
);
