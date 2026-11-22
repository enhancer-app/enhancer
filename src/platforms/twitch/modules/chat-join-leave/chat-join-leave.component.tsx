import type { ChatJoinLeaveProps } from "$types/platforms/twitch/twitch.chat-join-leave.types.ts";
import { useState } from "preact/hooks";
import styled from "styled-components";

const INLINE_LIMIT = 3;

function formatNames({ joined, left }: ChatJoinLeaveProps) {
	return [...joined.map((user) => `+${user}`), ...left.map((user) => `−${user}`)].join(" ");
}

function isInline({ joined, left }: ChatJoinLeaveProps) {
	return joined.length + left.length <= INLINE_LIMIT;
}

export function formatChatJoinLeave(props: ChatJoinLeaveProps) {
	if (isInline(props)) return formatNames(props);
	const counts = [];
	if (props.joined.length) counts.push(`${props.joined.length} joined`);
	if (props.left.length) counts.push(`${props.left.length} left`);
	return counts.join(", ");
}

export function ChatJoinLeaveComponent(props: ChatJoinLeaveProps) {
	const [expanded, setExpanded] = useState(props.showNames ?? false);
	if (isInline(props)) return <span>{formatNames(props)}</span>;

	return (
		<span>
			{expanded ? formatNames(props) : formatChatJoinLeave(props)}{" "}
			<Toggle onClick={() => setExpanded(!expanded)}>{expanded ? "hide" : "show who"}</Toggle>
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
