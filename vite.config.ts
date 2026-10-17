import { cpSync, existsSync } from "node:fs";
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
import generateFilePlugin from "vite-plugin-generate-file";
import tsconfigPaths from "vite-tsconfig-paths";
import { getChannel, getManifest, getVersion } from "./manifest.config";

const isDevelopment = process.env.ENVIRONMENT === "development";
// Classic content scripts share one global scope, so minified top-level names would collide.
const CONTENT_SCRIPT_CHUNKS = new Set(["inject", "worker.bridge"]);
const channel = getChannel();
const CHANNEL_ASSETS_DIR = `branding/${channel}`;

export default defineConfig({
	server: {
		port: 3360,
		strictPort: true,
		watch: {
			usePolling: true,
		},
		cors: true,
	},
	define: {
		__environment__: JSON.stringify(process.env.ENVIRONMENT),
		__version__: JSON.stringify(getVersion(channel)),
		__channel__: JSON.stringify(channel),
	},
	plugins: [
		preact(),
		tsconfigPaths(),
		generateFilePlugin({
			type: "json",
			output: "./manifest.json",
			data: getManifest(isDevelopment, channel),
		}),
		{
			name: "channel-assets",
			closeBundle() {
				if (existsSync(CHANNEL_ASSETS_DIR)) cpSync(CHANNEL_ASSETS_DIR, "dist/assets/enhancer", { recursive: true });
			},
		},
	],
	build: {
		outDir: "dist",
		sourcemap: isDevelopment,
		minify: !isDevelopment,
		rollupOptions: {
			output: {
				entryFileNames: "[name].js",
				chunkFileNames: "[name].js",
				assetFileNames: "[name].[ext]",
				banner: (chunk) => (CONTENT_SCRIPT_CHUNKS.has(chunk.name) ? "(() => {" : ""),
				footer: (chunk) => (CONTENT_SCRIPT_CHUNKS.has(chunk.name) ? "})();" : ""),
			},
			input: {
				index: "src/index.ts",
				inject: "src/inject.ts",
				"worker.bridge": "src/shared/worker/worker.bridge.ts",
				"worker.background": "src/shared/worker/worker.background.ts",
			},
		},
	},
});
