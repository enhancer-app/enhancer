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
