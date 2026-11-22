export type ChatJoinLeaveAction = "join" | "leave";

export type ChatJoinLeaveProps = {
	action: ChatJoinLeaveAction;
	users: string[];
	visibleCount: number;
};
