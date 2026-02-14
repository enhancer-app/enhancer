export type GQLResponse<T> = {
	data: T;
};

export type ChattersResponse = {
	channel: {
		chatters: {
			count: number;
		};
	};
};

export type VideoCreatedAtResponse = {
	video: {
		createdAt: string | null;
	} | null;
};

export type FollowNode = {
	id: string;
	login: string;
	displayName: string;
	profileImageURL?: string | null;
};

export type FollowEdge = {
	cursor: string;
	node: FollowNode;
};

export type FollowConnection = {
	edges: FollowEdge[];
	pageInfo: {
		hasNextPage: boolean;
	};
};

export type ChannelFollowsResponse = {
	user: {
		id: string;
		follows: FollowConnection;
	} | null;
};

export type TwitchUserData = {
	login: string;
	displayName: string;
	stream: TwitchStreamData | null;
};

export type TwitchStreamData = {
	type: string;
	viewersCount: number;
	game: {
		displayName: string;
	};
};

export type TwitchMultiStreamResponse = Record<string, TwitchUserData | null>;
