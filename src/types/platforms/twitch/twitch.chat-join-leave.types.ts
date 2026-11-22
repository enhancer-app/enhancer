export type ChatJoinLeaveAction = "join" | "leave";

export type ChatJoinLeaveProps = {
	joined: string[];
	left: string[];
};

export type ChatJoinLeaveEvent = {
	login: string;
	action: ChatJoinLeaveAction;
};

export type ChatJoinLeaveIrcResult = {
	data: string;
	events: ChatJoinLeaveEvent[];
};
