import { render } from "preact";
import styled from "styled-components";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import TwitchModule from "../../twitch.module.ts";

export default class ClipDownloadModule extends TwitchModule {
	private static URL_CONFIG = (url: string) => {
		return url.includes("/clip/") || url.includes("clips.twitch.tv");
	};

	readonly config: TwitchModuleConfig = {
		name: "clip-download",
		appliers: [
			{
				type: "selector",
				key: "clip-download",
				selectors: [".player-controls__left-control-group"],
				callback: this.run.bind(this),
				validateUrl: ClipDownloadModule.URL_CONFIG,
				once: true,
			},
			{
				type: "event",
				event: "twitch:chatInitialized",
				callback: () => {
					if (!ClipDownloadModule.URL_CONFIG(window.location.href)) {
						const elements = document.querySelectorAll("#enhancer-clip-download");
						elements.forEach((element) => element.remove());
					}
				},
				key: "clip-download-url-validator",
			},
		],
	};

	private run(elements: Element[]) {
		const wrappers = elements.map((element) => {
			const wrapper = document.createElement("div");
			wrapper.id = this.getId();
			element.appendChild(wrapper);
			return wrapper;
		});

		wrappers.forEach((element) => {
			render(<DownloadButtonComponent click={this.downloadClip.bind(this)} />, element);
		});
	}

	private downloadClip() {
		const videoElement = document.querySelector("video");
		if (!videoElement?.src) {
			this.logger.warn("Failed to find video source");
			return;
		}
		window.open(videoElement.src);
	}
}

interface DownloadButtonComponentProps {
	click: () => void;
}

const Wrapper = styled.div`
	color: #fff;
	margin: 0 0.25rem;
	width: 30px;
	height: 30px;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: var(--border-radius-medium);
	cursor: pointer;
	position: relative;

	&:hover {
		background-color: var(--color-background-button-icon-overlay-hover);
	}
`;

function DownloadButtonComponent({ click }: DownloadButtonComponentProps) {
	return (
		<Wrapper onClick={click}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				width="20px"
				height="20px"
				stroke="currentColor"
				aria-hidden="true"
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="2.5"
					d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
				/>
			</svg>
		</Wrapper>
	);
}
