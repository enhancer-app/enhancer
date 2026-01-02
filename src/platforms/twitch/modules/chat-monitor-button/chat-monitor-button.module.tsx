import { ChatMonitorPingMenu } from "$shared/components/chat-monitor-ping/chat-monitor-ping-menu.component.tsx";
import { TooltipComponent } from "$shared/components/tooltip/tooltip.component.tsx";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import { render } from "preact";
import { useState } from "preact/hooks";
import styled from "styled-components";
import TwitchModule from "../../twitch.module.ts";

export default class ChatMonitorButtonModule extends TwitchModule {
	readonly config: TwitchModuleConfig = {
		name: "chat-monitor-button",
		appliers: [
			{
				type: "selector",
				selectors: [".top-nav__menu"],
				callback: this.run.bind(this),
				key: "chat-monitor-button-main",
				once: true,
			},
			{
				type: "event",
				event: "extension:chat-monitor-open",
				callback: this.openChatMonitor.bind(this),
				key: "chat-monitor-open",
			},
		],
	};

	private menuContainer: HTMLDivElement | null = null;

	private async run(elements: Element[], key: string) {
		const properElements = elements
			.filter((element) => element.children.length > 0)
			.map((element) => [...element.children].at(-1))
			.filter((element) => element !== undefined) as Element[];
		const wrappers = this.commonUtils().createEmptyElements(this.getId(), properElements, "span");
		const logo = await this.commonUtils().getAssetFile(this.workerService(), "enhancer/logo-gray.svg");

		wrappers.forEach((element) => {
			render(
				<TooltipComponent content={<p>Open Chat Monitor</p>} position="bottom">
					<ChatMonitorButtonComponent onClick={this.openChatMonitor.bind(this)} logoUrl={logo} />
				</TooltipComponent>,
				element,
			);
		});
	}

	private openChatMonitor() {
		// Create menu container if it doesn't exist
		if (!this.menuContainer) {
			this.menuContainer = document.createElement("div");
			this.menuContainer.id = `${this.getId()}-menu-container`;
			document.body.appendChild(this.menuContainer);
		}

		// Render the menu
		render(
			<ChatMonitorPingMenu workerService={this.workerService()} onClose={this.closeChatMonitor.bind(this)} />,
			this.menuContainer,
		);
	}

	private closeChatMonitor() {
		if (this.menuContainer) {
			render(null, this.menuContainer);
		}
	}

	async initialize() {
		this.commonUtils().createGlobalStyle(`
			.top-nav__menu .enhancer-chat-monitor-button { order: -6 !important; }
		`);

		// Listen for keyword match events from background via worker service
		this.workerService().onBackgroundMessage((message) => {
			if (message.action === "chatMonitorPing") {
				// Show notification or update badge
				this.showNotificationBadge();
			}
		});
	}

	private showNotificationBadge() {
		// Add a visual indicator that there's a new match
		const buttons = document.querySelectorAll(".enhancer-chat-monitor-button button");
		for (const button of buttons) {
			button.classList.add("has-notification");
		}
	}
}

const StyledChatMonitorButton = styled.button`
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

	&:hover {
		background: var(--color-background-button-text-hover);
	}

	&:focus-visible {
		outline: 2px solid var(--color-focus, #007bff);
		outline-offset: 2px;
	}

	&.has-notification::after {
		content: "";
		position: absolute;
		top: 6px;
		right: 6px;
		width: 8px;
		height: 8px;
		background: #9147ff;
		border-radius: 50%;
		border: 2px solid #0d0d0d;
	}

	img {
		filter: brightness(0) invert(0.5);
	}

	&:hover img {
		filter: brightness(0) invert(0.7);
	}
`;

interface ChatMonitorButtonComponentProps {
	onClick: () => void;
	logoUrl: string;
}

function ChatMonitorButtonComponent({ onClick, logoUrl }: ChatMonitorButtonComponentProps) {
	const [hasNotification] = useState(false);

	return (
		<StyledChatMonitorButton onClick={onClick} className={hasNotification ? "has-notification" : ""}>
			<img src={logoUrl} alt={"Chat Monitor"} />
		</StyledChatMonitorButton>
	);
}
