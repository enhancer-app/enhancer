import type { ChangelogNotifier } from "$shared/changelog/changelog.notifier.ts";
import styled, { keyframes } from "styled-components";

const pulse = keyframes`
	0% {
		transform: scale(1);
		opacity: 0.7;
	}
	70%,
	100% {
		transform: scale(2.6);
		opacity: 0;
	}
`;

const Dot = styled.span`
	position: absolute;
	top: 3px;
	right: 3px;
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: #9147ff;
	box-shadow: 0 0 0 2px var(--enhancer-changelog-dot-ring, transparent);
	pointer-events: none;

	&::after {
		content: "";
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: #9147ff;
		animation: ${pulse} 1.8s cubic-bezier(0.22, 1, 0.36, 1) infinite;
	}

	@media (prefers-reduced-motion: reduce) {
		&::after {
			animation: none;
			opacity: 0;
		}
	}
`;

export function ChangelogDot({ notifier }: { notifier: ChangelogNotifier }) {
	if (!notifier.notice.value) return null;
	return <Dot className="enhancer-changelog-dot" aria-hidden="true" />;
}

export function changelogButtonLabel(notifier: ChangelogNotifier, label: string): string {
	const entry = notifier.notice.value;
	return entry ? `${label} (what's new in ${entry.version})` : label;
}
