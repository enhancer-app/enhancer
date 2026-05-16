import KickModule from "$kick/kick.module.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";
import { render } from "preact";
import styled from "styled-components";

export default class SettingsButtonModule extends KickModule {
	readonly config: KickModuleConfig = {
		name: "settings-button",
		appliers: [
			{
				type: "selector",
				selectors: ["nav"],
				callback: this.run.bind(this),
				key: "settings-button-main",
				once: true,
			},
		],
	};

	private async run(elements: Element[]) {
		const menu = elements.at(0)?.lastElementChild;
		if (!menu) return;
		const wrappers = this.commonUtils().createEmptyElements(this.getId(), [menu], "span");
		const logo = await this.commonUtils().getAssetFile(this.workerService(), "enhancer/logo-gray.svg");
		wrappers.forEach((element) => {
			element.style.order = "-1";
			render(<SettingsButtonComponent onClick={this.openSettings.bind(this)} logoUrl={logo} />, element);
		});
	}

	private openSettings() {
		this.emitter.emit("extension:settings-open");
	}
}

const StyledSettingsButton = styled.button`
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 8px;
	width: 30px;
	height: 30px;
	cursor: pointer;
	position: relative;

	border: none;
	background: transparent;
	padding: 0;
	color: inherit;

	&:hover {
		background: #36393f;
	}

	&:focus-visible {
		outline: 2px solid #007bff;
		outline-offset: 2px;
	}
`;

interface SettingsButtonComponentProps {
	onClick: () => void;
	logoUrl: string;
}

function SettingsButtonComponent({ onClick, logoUrl }: SettingsButtonComponentProps) {
	return (
		<StyledSettingsButton onClick={onClick}>
			<img src={logoUrl} alt={"Enhancer Settings"} />
		</StyledSettingsButton>
	);
}
