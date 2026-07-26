import { TooltipComponent } from "$shared/components/tooltip/tooltip.component.tsx";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import { render } from "preact";
import styled from "styled-components";
import TwitchModule from "../../twitch.module.ts";

export default class SettingsButtonModule extends TwitchModule {
	readonly config: TwitchModuleConfig = {
		name: "settings-button",
		appliers: [
			{
				type: "selector",
				selectors: [".top-nav__menu"],
				callback: this.run.bind(this),
				key: "settings-button-main",
				once: true,
			},
		],
	};

	private async run(elements: Element[], key: string) {
		const properElements = elements
			.filter((element) => element.children.length > 0)
			.map((element) => [...element.children].at(-1))
			.filter((element) => element !== undefined) as Element[];
		const wrappers = this.commonUtils().createEmptyElements(this.getId(), properElements, "span");
		const logo = await this.commonUtils().getAssetFile(this.workerService(), "enhancer/logo-gray.svg");
		wrappers.forEach((element) => {
			render(
				<TooltipComponent content={<p>Open Enhancer Settings</p>} position="bottom">
					<SettingsButtonComponent onClick={this.openSettings.bind(this)} logoUrl={logo} />
				</TooltipComponent>,
				element,
			);
		});
	}

	private openSettings() {
		this.emitter.emit("extension:settings-open");
	}

	async initialize() {
		this.commonUtils().createGlobalStyle(`
			.top-nav__menu .enhancer-settings-button { order: -5 !important; }
		    .top-nav__menu .ffz-top-nav { order: -4 !important; }
		    .top-nav__menu #seventv-settings-button { order: -3 !important; }
		    .top-nav__menu .seventv-settings-module-root { display: flex; order: -3 !important; }
		`);
	}
}

const StyledSettingsButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--border-radius-medium);
  width: 30px;
  height: 30px;
  cursor: pointer;
  position: relative;
  margin-top: 4px;

  border: none;
  background: transparent;
  padding: 0;
  color: inherit;

  img {
    filter: none;
  }

  html.tw-root--theme-light & img {
    filter: brightness(0);
  }

  &:hover {
    background: var(--color-background-button-text-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--color-focus, #007bff);
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
