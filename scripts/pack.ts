import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

const { spawn, file, write } = Bun;

const IGNORED_DIRS = new Set([".github", ".husky", ".idea", "dist", "node_modules", ".git"]);

async function archiveDirectory(
	sourceDir: string,
	outPath: string,
	exclude: Set<string> = new Set(),
	extraFiles: Record<string, string> = {},
) {
	const zip = new JSZip();
	for (const [name, content] of Object.entries(extraFiles)) zip.file(name, content);

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

const exitCode = await buildProc.exited;
if (exitCode !== 0) {
	console.error("Build failed");
	process.exit(exitCode);
}

const manifest = await file("dist/manifest.json").json();
const version = manifest.version;

const buildZipPath = path.join("dist", `build-${version}.zip`);
await archiveDirectory("dist", buildZipPath);
console.log(`Created ${buildZipPath}`);

const sourceZipPath = path.join("dist", `source-${version}.zip`);
const sourceExtras: Record<string, string> = {};
if (process.env.CHANNEL === "canary") {
	sourceExtras["CANARY_BUILD.md"] = [
		`# Enhancer Canary ${version}`,
		"",
		"Build this package with:",
		"",
		"```sh",
		"bun install",
		`CHANNEL=canary CANARY_BUILD=${process.env.CANARY_BUILD ?? "0"} bun run pack`,
		"```",
		"",
	].join("\n");
}
await archiveDirectory(".", sourceZipPath, IGNORED_DIRS, sourceExtras);
console.log(`Created ${sourceZipPath}`);
