import type { ChangelogNotifier } from "$shared/changelog/changelog.notifier.ts";
import { SETTINGS_FONT } from "$shared/components/settings/settings-theme.ts";
import styled from "styled-components";

const Wrapper = styled.div`
	position: relative;
	z-index: 1;
	flex-shrink: 0;
	width: 100%;
	max-width: 860px;
	margin: 0 auto;
	padding: 24px 56px 0;
`;

const Card = styled.section`
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 10px 14px;
	padding: 12px 12px 12px 16px;
	border-radius: 12px;
	background: var(--settings-accent-soft);
	box-shadow: inset 0 0 0 1px rgba(145, 71, 255, 0.35);
	font-family: ${SETTINGS_FONT};
`;

const Icon = styled.div`
	display: grid;
	place-items: center;
	flex-shrink: 0;
	width: 32px;
	height: 32px;
	border-radius: 8px;
	background: var(--settings-accent);
	color: #ffffff;
`;

const Text = styled.div`
	display: flex;
	flex-direction: column;
	gap: 2px;
	flex: 1 1 220px;
	min-width: 0;
`;

const Eyebrow = styled.span`
	white-space: nowrap;
	font-size: 12px;
	font-weight: 500;
	color: var(--settings-text-muted);
`;

const Title = styled.h2`
	margin: 0;
	font-size: 14px;
	font-weight: 600;
	line-height: 20px;
	color: var(--settings-text-primary);
	overflow-wrap: anywhere;
`;

const Actions = styled.div`
	display: flex;
	align-items: center;
	gap: 4px;
	flex-shrink: 0;
	margin-left: auto;
`;

const Button = styled.button`
	display: inline-flex;
	align-items: center;
	gap: 6px;
	height: 32px;
	padding: 0 12px;
	border: none;
	border-radius: 8px;
	font-family: ${SETTINGS_FONT};
	font-size: 13px;
	font-weight: 500;
	white-space: nowrap;
	cursor: pointer;

	&:focus-visible {
		outline: 2px solid var(--settings-accent);
		outline-offset: 2px;
	}
`;

const PrimaryButton = styled(Button)`
	background: var(--settings-accent);
	color: #ffffff;

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
	width: 32px;
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
	return (
		<Wrapper>
			<Card aria-label={`What's new in ${entry.version}`}>
				<Icon>{SparkIcon}</Icon>
				<Text>
					<Eyebrow>What's new in {entry.version}</Eyebrow>
					<Title>{entry.title}</Title>
				</Text>
				<Actions>
					<QuietButton onClick={() => void notifier.disable()}>Never show again</QuietButton>
					<PrimaryButton onClick={() => void notifier.open()}>
						See what's new
						{ExternalIcon}
					</PrimaryButton>
					<DismissButton onClick={() => void notifier.dismiss()} title="Dismiss" aria-label="Dismiss">
						{CloseIcon}
					</DismissButton>
				</Actions>
			</Card>
		</Wrapper>
	);
}

const OutlineButton = styled(Button)`
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
