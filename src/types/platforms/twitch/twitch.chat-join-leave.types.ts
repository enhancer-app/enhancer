export type ChatJoinLeaveAction = "join" | "leave";

export type ChatJoinLeaveProps = {
	joined: string[];
	left: string[];
	visibleCount: number;
};

export type ChatJoinLeaveGroupProps = {
	action: ChatJoinLeaveAction;
	users: string[];
	limit: number;
	onExpand: () => void;
};
