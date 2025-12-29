import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

const { spawn, file, write } = Bun;

const IGNORED_DIRS = new Set([".github", ".husky", ".idea", "dist", "node_modules", ".git"]);

async function archiveDirectory(sourceDir: string, outPath: string, exclude: Set<string> = new Set()) {
	const zip = new JSZip();

	async function traverse(currentDir: string, relativePath: string) {
		const entries = await readdir(currentDir, { withFileTypes: true });

		for (const entry of entries) {
			if (exclude.has(entry.name)) continue;

			const fullPath = path.join(currentDir, entry.name);
			const entryRelPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

			if (entry.isDirectory()) {
				await traverse(fullPath, entryRelPath);
			} else {
				zip.file(entryRelPath, await readFile(fullPath));
			}
		}
	}

	await traverse(sourceDir, "");
	await write(outPath, await zip.generateAsync({ type: "uint8array" }));
}

const buildProc = spawn(["bun", "run", "build"], {
	stdout: "inherit",
	stderr: "inherit",
});

if ((await buildProc.exited) !== 0) {
	console.error("Build failed");
	process.exit(1);
}

const manifest = await file("dist/manifest.json").json();
const version = manifest.version;

const buildZipPath = path.join("dist", `build-${version}.zip`);
await archiveDirectory("dist", buildZipPath);
console.log(`Created ${buildZipPath}`);

const sourceZipPath = path.join("dist", `source-${version}.zip`);
await archiveDirectory(".", sourceZipPath, IGNORED_DIRS);
console.log(`Created ${sourceZipPath}`);
