import type { ChangelogNotifier } from "$shared/changelog/changelog.notifier.ts";
import { SETTINGS_FONT } from "$shared/components/settings/settings-theme.ts";
import styled, { css } from "styled-components";

const Wrapper = styled.div`
	position: relative;
	z-index: 1;
	flex-shrink: 0;
	width: 100%;
	max-width: 860px;
	margin: 0 auto;
	padding: 16px 56px 0;
`;

const Card = styled.section`
	container-type: inline-size;
	display: flex;
	align-items: center;
	gap: 10px;
	height: 40px;
	padding: 0 6px 0 12px;
	border-radius: 10px;
	background: var(--settings-accent-soft);
	box-shadow: inset 0 0 0 1px rgba(145, 71, 255, 0.35);
	font-family: ${SETTINGS_FONT};
`;

const Icon = styled.span`
	display: flex;
	flex-shrink: 0;
	color: var(--settings-accent);
`;

const Text = styled.a`
	flex: 1;
	min-width: 0;
	overflow: hidden;
	font-size: 13px;
	line-height: 20px;
	text-decoration: none;
	text-overflow: ellipsis;
	white-space: nowrap;

	&&,
	&&:hover,
	&&:visited {
		color: var(--settings-text-primary);
		text-decoration: none;
	}

	&:hover strong {
		text-decoration: underline;
	}

	&:focus-visible {
		border-radius: 4px;
		outline: 2px solid var(--settings-accent);
	}
`;

const Title = styled.strong`
	font-weight: 600;
`;

const Prefix = styled.span`
	@container (max-width: 560px) {
		display: none;
	}
`;

const Actions = styled.div`
	display: flex;
	align-items: center;
	gap: 2px;
	flex-shrink: 0;
`;

const buttonStyles = css`
	display: inline-flex;
	align-items: center;
	gap: 6px;
	height: 28px;
	padding: 0 10px;
	border: none;
	border-radius: 8px;
	font-family: ${SETTINGS_FONT};
	font-size: 12px;
	font-weight: 500;
	text-decoration: none;
	white-space: nowrap;
	cursor: pointer;

	&:focus-visible {
		outline: 2px solid var(--settings-accent);
		outline-offset: 2px;
	}
`;

const Button = styled.button`
	${buttonStyles}
`;

const PrimaryLink = styled.a`
	${buttonStyles}
	background: var(--settings-accent);

	&&,
	&&:hover,
	&&:visited {
		color: #ffffff;
		text-decoration: none;
	}

	&:hover {
		background: var(--settings-accent-hover);
	}
`;

const QuietButton = styled(Button)`
	background: transparent;
	color: var(--settings-text-muted);

	&:hover {
		background: var(--settings-surface-hover);
		color: var(--settings-text-primary);
	}
`;

const DismissButton = styled(QuietButton)`
	justify-content: center;
	width: 28px;
	padding: 0;
`;

const SparkIcon = (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
		<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" stroke-linejoin="round" />
		<path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" stroke-linejoin="round" />
	</svg>
);

const ExternalIcon = (
	<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
		<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" stroke-linecap="round" />
	</svg>
);

const CloseIcon = (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
		<path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
	</svg>
);

export function ChangelogNotice({ notifier }: { notifier: ChangelogNotifier }) {
	const entry = notifier.notice.value;
	if (!entry) return null;
	const link = {
		href: entry.url,
		target: "_blank",
		rel: "noopener noreferrer",
		onClick: () => void notifier.markSeen(),
		onAuxClick: (event: MouseEvent) => {
			if (event.button === 1) void notifier.markSeen();
		},
	};
	return (
		<Wrapper data-settings-notice="">
			<Card aria-label={`What's new in ${entry.version}`}>
				<Icon>{SparkIcon}</Icon>
				<Text {...link} title={`What's new in ${entry.version}: ${entry.title}`}>
					<Prefix>What's new in </Prefix>
					{entry.version}: <Title>{entry.title}</Title>
				</Text>
				<Actions>
					<QuietButton onClick={() => void notifier.disable()}>Never show again</QuietButton>
					<PrimaryLink {...link}>
						See what's new
						{ExternalIcon}
					</PrimaryLink>
					<DismissButton onClick={() => void notifier.markSeen()} title="Dismiss" aria-label="Dismiss">
						{CloseIcon}
					</DismissButton>
				</Actions>
			</Card>
		</Wrapper>
	);
}

const OutlineButton = styled(Button)`
	height: 32px;
	padding: 0 12px;
	font-size: 13px;
	background: var(--settings-control-background);
	box-shadow: inset 0 0 0 1px var(--settings-control-border);
	color: var(--settings-text-primary);

	&:hover {
		background: var(--settings-control-hover);
	}
`;

export function ChangelogResetButton({ notifier }: { notifier: ChangelogNotifier }) {
	return <OutlineButton onClick={() => void notifier.showAgain()}>Show again</OutlineButton>;
}
