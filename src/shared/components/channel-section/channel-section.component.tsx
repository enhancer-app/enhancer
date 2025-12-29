import type { QuickAccessLink } from "$types/shared/components/settings.component.types.ts";
import type { Signal } from "@preact/signals";
import styled from "styled-components";

interface ChannelSectionComponentProps {
	displayName: Signal<string>;
	login: Signal<string>;
	sites: Signal<QuickAccessLink[]>;
	watchTime: Signal<number>;
	logoUrl: string;
}

export function ChannelSectionComponent({
	displayName,
	login,
	sites,
	watchTime,
	logoUrl,
}: ChannelSectionComponentProps) {
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

const Container = styled.div`
	background: rgba(25, 25, 28, 0.95);
	border-radius: 8px;
	overflow: hidden;
	margin: 16px 0;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
	border: 1px solid rgba(255, 255, 255, 0.05);
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
	background: rgba(30, 30, 40, 0.6);
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
	color: #ffffff;
	font-size: 14px;
`;

const RowText = styled.div`
	color: #b8b8b8;
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
	background: rgba(40, 40, 50, 0.6);
	border-radius: 6px;
	color: #e0e0e0;
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
