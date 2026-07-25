import { TooltipComponent } from "$shared/components/tooltip/tooltip.component.tsx";
import type { QuickAccessLink } from "$types/shared/components/settings.component.types.ts";
import type { Signal } from "@preact/signals";
import styled from "styled-components";

export interface ChannelSectionAction {
	key: string;
	icon: Signal<string> | string;
	tooltip: Signal<string> | string;
	onClick: () => void;
}

interface ChannelSectionComponentProps {
	displayName: Signal<string>;
	login: Signal<string>;
	sites: Signal<QuickAccessLink[]>;
	watchTime: Signal<number>;
	logoUrl: string;
	actions?: Signal<ChannelSectionAction[]> | ChannelSectionAction[];
}

export function ChannelSectionComponent({
	displayName,
	login,
	sites,
	watchTime,
	logoUrl,
	actions = [],
}: ChannelSectionComponentProps) {
	const actionList = Array.isArray(actions) ? actions : actions.value;
	const formatWatchTime = (time: number) => {
		const hours = time === 0 ? 0 : time / 3600;
		if (hours < 1) return `${Math.round(hours * 60)} minutes`;
		if (hours < 10) return `${hours.toFixed(1)} hours`;
		return `${Math.round(hours)} hours`;
	};

	return (
		<Container>
			<Header>
				<ChannelInfo>
					<LogoContainer>
						<img src={logoUrl} alt={"Enhancer Logo"} />
					</LogoContainer>
					<ChannelDetails>
						<ChannelNameRow>
							<ChannelName>{displayName.value}</ChannelName>
							<RowText>—</RowText>
							<RowText>You've watched this channel for {formatWatchTime(watchTime.value)}</RowText>
						</ChannelNameRow>
					</ChannelDetails>
				</ChannelInfo>
				{actionList.length > 0 && (
					<HeaderActions>
						{actionList.map((action) => {
							const iconText = getActionText(action.icon);
							const tooltipText = getActionText(action.tooltip);
							return (
								<TooltipComponent key={action.key} content={<span>{tooltipText}</span>} position="right">
									<ActionButton type="button" onClick={action.onClick} aria-label={tooltipText}>
										{iconText}
									</ActionButton>
								</TooltipComponent>
							);
						})}
					</HeaderActions>
				)}
			</Header>
			<Content>
				<LinkGrid>
					{sites.value.map((site) => {
						const fullUrl = site.url.replace("%username%", login.value);
						return (
							<LinkItem key={site.title} href={fullUrl} target="_blank" rel="noopener noreferrer">
								<LinkName>{site.title}</LinkName>
							</LinkItem>
						);
					})}
				</LinkGrid>
			</Content>
		</Container>
	);
}

function getActionText(value: Signal<string> | string) {
	if (typeof value === "string") return value;
	return value.value;
}

const Container = styled.div`
	--channel-background: rgba(25, 25, 28, 0.95);
	--channel-header-background: rgba(30, 30, 40, 0.6);
	--channel-border: rgba(255, 255, 255, 0.05);
	--channel-title: #ffffff;
	--channel-text: #b8b8b8;
	--channel-link-background: rgba(40, 40, 50, 0.6);
	--channel-action-background: rgba(255, 255, 255, 0.08);
	--channel-action-text: #ffffff;

	html.tw-root--theme-light & {
		--channel-background: #ffffff;
		--channel-header-background: #f1f1f2;
		--channel-border: #dedee3;
		--channel-title: #0e0e10;
		--channel-text: #53535f;
		--channel-link-background: #efeff1;
		--channel-action-background: rgba(0, 0, 0, 0.06);
		--channel-action-text: #0e0e10;
	}

	background: var(--channel-background);
	border-radius: 8px;
	overflow: hidden;
	margin: 16px 0;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
	border: 1px solid var(--channel-border);
	transition: all 0.2s ease;

	&:hover {
		border-color: rgba(145, 71, 255, 0.3);
		box-shadow: 0 4px 16px rgba(145, 71, 255, 0.15);
	}
`;

const Header = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 12px 16px;
	background: var(--channel-header-background);
`;

const ChannelInfo = styled.div`
	display: flex;
	align-items: center;
	width: 100%;
`;

const LogoContainer = styled.div`
	margin-right: 8px;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
`;

const ChannelDetails = styled.div`
	display: flex;
	flex-direction: column;
	flex-grow: 1;
`;

const ChannelNameRow = styled.div`
	display: flex;
	align-items: center;
	gap: 12px;
`;

const ChannelName = styled.div`
	font-weight: 600;
	color: var(--channel-title);
	font-size: 14px;
`;

const RowText = styled.div`
	color: var(--channel-text);
	font-size: 12px;
	display: flex;
	align-items: center;
`;

const Content = styled.div`
	padding: 12px 16px;
`;

const LinkGrid = styled.div`
	display: flex;
	gap: 8px;
`;

const LinkItem = styled.a`
	display: flex;
	align-items: center;
	padding: 8px 12px;
	background: var(--channel-link-background);
	border-radius: 6px;
	color: var(--channel-title);
	text-decoration: none;
	transition: all 0.2s;

	&:hover {
		background: rgba(145, 71, 255, 0.2);
		color: white;
		transform: translateY(-2px);
		text-decoration: none;
	}
`;

const LinkName = styled.div`
	font-size: 13px;
	font-weight: 500;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
`;

const HeaderActions = styled.div`
	display: flex;
	align-items: center;
	gap: 6px;
	margin-left: 10px;
`;

const ActionButton = styled.button`
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	border: none;
	border-radius: 4px;
	background: var(--channel-action-background);
	color: var(--channel-action-text);
	cursor: pointer;
	padding: 0;
	font-size: 14px;
	line-height: 1;

	&:hover {
		background: rgba(145, 71, 255, 0.3);
		color: #ffffff;
	}
`;
