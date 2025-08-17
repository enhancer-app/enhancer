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
		createdAt: string;
	};
};

export type TwitchChannelNode = {
	id: string;
	displayName: string;
	owner: {
		id: string;
		login: string;
		profileImageURL: string;
	};
	stream:
		| {
			id: string;
			title: string;
			viewersCount: number;
			game: { name: string } | null;
		}
		| null;
};

export type TwitchMultiChannelResponse = {
	[K in `a${number}`]?: TwitchChannelNode | null;
};
