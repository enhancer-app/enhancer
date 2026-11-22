import type {
	ChatJoinLeaveAction,
	ChatJoinLeaveGroupProps,
	ChatJoinLeaveProps,
} from "$types/platforms/twitch/twitch.chat-join-leave.types.ts";
import { useState } from "preact/hooks";
import styled from "styled-components";

const SIGNS: Record<ChatJoinLeaveAction, string> = { join: "+", leave: "−" };
const COLORS: Record<ChatJoinLeaveAction, string> = { join: "#2ecc71", leave: "#ff4757" };

function formatGroup(action: ChatJoinLeaveAction, users: string[], visibleCount: number) {
	const names = users.slice(0, visibleCount).map((user) => `${SIGNS[action]}${user}`);
	const hidden = users.length - visibleCount;
	return hidden > 0 ? [...names, `… ${hidden} more`].join(" ") : names.join(" ");
}

export function formatChatJoinLeave({ joined, left, visibleCount }: ChatJoinLeaveProps) {
	return [formatGroup("join", joined, visibleCount), formatGroup("leave", left, visibleCount)]
		.filter(Boolean)
		.join("  ");
}

export function ChatJoinLeaveComponent({ joined, left, visibleCount }: ChatJoinLeaveProps) {
	const [expanded, setExpanded] = useState(false);
	const collapsible = joined.length > visibleCount || left.length > visibleCount;
	const limit = expanded ? Infinity : visibleCount;
	const expand = () => setExpanded(true);

	return (
		<Line>
			<Group action="join" users={joined} limit={limit} onExpand={expand} />
			<Group action="leave" users={left} limit={limit} onExpand={expand} />
			{expanded && collapsible && <Toggle onClick={() => setExpanded(false)}>show less</Toggle>}
		</Line>
	);
}

function Group({ action, users, limit, onExpand }: ChatJoinLeaveGroupProps) {
	if (!users.length) return null;
	const hidden = users.length - limit;
	const hiddenUsers = users.slice(limit);

	return (
		<GroupWrapper>
			{users.slice(0, limit).map((user) => (
				<Name key={user} $color={COLORS[action]}>
					{SIGNS[action]}
					{user}
				</Name>
			))}
			{hidden > 0 && (
				<Toggle onClick={onExpand} title={hiddenUsers.join(", ")}>
					{`… ${hidden} more`}
				</Toggle>
			)}
		</GroupWrapper>
	);
}

const Line = styled.span`
	display: inline-flex;
	flex-wrap: wrap;
	gap: 0 1.2rem;
`;

const GroupWrapper = styled.span`
	display: inline-flex;
	flex-wrap: wrap;
	gap: 0 0.5rem;
`;

const Name = styled.span<{ $color: string }>`
	color: ${({ $color }) => $color};
`;

const Toggle = styled.button`
	padding: 0;
	border: none;
	background: none;
	color: var(--color-text-alt-2, #adadb8);
	font: inherit;
	cursor: pointer;

	&:hover {
		color: var(--color-text-link, #bf94ff);
		text-decoration: underline;
	}
`;
