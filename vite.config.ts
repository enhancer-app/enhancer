import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
import generateFilePlugin from "vite-plugin-generate-file";
import tsconfigPaths from "vite-tsconfig-paths";
import { getManifest } from "./manifest.config";
import { version } from "./package.json";

const isDevelopment = process.env.ENVIRONMENT === "development";

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
		__version__: JSON.stringify(version),
	},
	plugins: [
		preact(),
		tsconfigPaths(),
		generateFilePlugin({
			type: "json",
			output: "./manifest.json",
			data: getManifest(isDevelopment),
		}),
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
