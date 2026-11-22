import type { ChatJoinLeaveAction, ChatJoinLeaveProps } from "$types/platforms/twitch/twitch.chat-join-leave.types.ts";
import { useState } from "preact/hooks";
import styled from "styled-components";

const VERBS: Record<ChatJoinLeaveAction, string> = { join: "joined", leave: "left" };

export function formatChatJoinLeave({ action, users, visibleCount }: ChatJoinLeaveProps) {
	const hidden = users.length - visibleCount;
	const names = users.slice(0, visibleCount).join(", ");
	return hidden > 0 ? `${names} and ${hidden} more ${VERBS[action]}` : `${names} ${VERBS[action]}`;
}

export function ChatJoinLeaveComponent({ action, users, visibleCount }: ChatJoinLeaveProps) {
	const [expanded, setExpanded] = useState(false);
	const hidden = users.length - visibleCount;

	if (hidden <= 0) return <span>{formatChatJoinLeave({ action, users, visibleCount })}</span>;

	if (expanded) {
		return (
			<span>
				{users.join(", ")} {VERBS[action]} <Toggle onClick={() => setExpanded(false)}>show less</Toggle>
			</span>
		);
	}

	return (
		<span>
			{users.slice(0, visibleCount).join(", ")}{" "}
			<Toggle onClick={() => setExpanded(true)} title={users.slice(visibleCount).join(", ")}>
				and {hidden} more
			</Toggle>{" "}
			{VERBS[action]}
		</span>
	);
}

const Toggle = styled.button`
	padding: 0;
	border: none;
	background: none;
	color: var(--color-text-link, #bf94ff);
	font: inherit;
	cursor: pointer;

	&:hover {
		text-decoration: underline;
	}
`;
