import { EnhancerAccountComponent } from "$shared/components/enhancer-account/enhancer-account.component.tsx";
import {
	SETTINGS_DARK_THEME,
	SETTINGS_FONT,
	SETTINGS_LIGHT_THEME,
} from "$shared/components/settings/settings-theme.ts";
import { RuntimeWorkerClient } from "$shared/worker/runtime-worker.client.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import { render } from "preact";
import { createGlobalStyle } from "styled-components";

const params = new URLSearchParams(location.search);
const platform: PlatformType = params.get("platform") === "kick" ? "kick" : "twitch";
const light = params.get("theme") === "light";

const GlobalStyle = createGlobalStyle<{ $light: boolean }>`
	@font-face {
		font-family: "Inter";
		font-style: normal;
		font-weight: 100 900;
		font-display: swap;
		src: url("/assets/fonts/inter-latin.woff2") format("woff2");
		unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329,
			U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
	}

	@font-face {
		font-family: "Inter";
		font-style: normal;
		font-weight: 100 900;
		font-display: swap;
		src: url("/assets/fonts/inter-latin-ext.woff2") format("woff2");
		unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF,
			U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
	}

	:root {
		${SETTINGS_DARK_THEME}
		${({ $light }) => ($light ? SETTINGS_LIGHT_THEME : "")}
		color-scheme: ${({ $light }) => ($light ? "light" : "dark")};
	}

	* {
		box-sizing: border-box;
	}

	html,
	body {
		margin: 0;
		min-height: 100%;
		background: var(--settings-background);
		color: var(--settings-text-primary);
		font-family: ${SETTINGS_FONT};
		-webkit-font-smoothing: antialiased;
		scrollbar-width: thin;
		scrollbar-color: var(--settings-surface-hover) transparent;
	}

	#app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	#app > * {
		flex: 1;
	}
`;

render(
	<>
		<GlobalStyle $light={light} />
		<EnhancerAccountComponent
			workerService={new RuntimeWorkerClient()}
			platform={platform}
			logoUrl={chrome.runtime.getURL("assets/enhancer/logo.svg")}
		/>
	</>,
	document.getElementById("app")!,
);
