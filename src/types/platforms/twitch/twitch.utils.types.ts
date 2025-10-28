import type gql from "graphql-tag";

export type PersistentPlayerComponent = {
	props: { content: { type: "live"; channelLogin: string } };
};

export type ChatControllerMessage = {
	id: number;
	type: number;
	msgid: number;
	message: string;
	channel: string;
};

export type ChatControllerComponent = {
	pushMessage: (message: ChatControllerMessage) => void;
	props: {
		channelLogin: string;
		channelID: string;
		messageHandlerAPI: {
			addMessageHandler: (callback: (message: TwitchChatMessage) => void) => void;
		};
	};
};

export type TwitchChatMessage = {
	badges: Record<string, string>;
	id: string;
	nonce: string;
	user: TwitchChatMessageUser;
	isVip: boolean | undefined;
	isFirstMsg: boolean | undefined;
	isHistorical: boolean | undefined;
	message: string;
	timestamp: number;
	type: number;
	createdAt: number;
};

export type TwitchChatMessageUser = {
	userID: string;
	userDisplayName: string;
	userLogin: string;
	color: string;
	isSubscriber: boolean;
};

export type MediaPlayerComponent = {
	props: {
		mediaPlayerInstance: MediaPlayerInstance;
		content: MediaPlayerContentType;
	};
};

export type MediaPlayerContentType =
	| {
			channelLogin: string;
			type: "live";
	  }
	| { vodID: string; type: "vod" };

export type MediaPlayerInstance = {
	core: { state: { liveLatency: number; ingestLatency: number }; paused: boolean };
	seekTo: (time: number) => void;
	getPosition(): number;
};

export type FollowedSectionComponenet = {
	props: {
		collapsed: boolean;
		section: {
			streams: FollowedSectionStreamData[];
			offlineChannels: FollowedSectionStreamData[];
		};
		sort: {
			setSortType: (type: string) => void;
			type: string;
		};
	};
	forceUpdate: () => void;
};

export type FollowedSectionStreamData = {
	modelTrackingID: string;
	promotionsCampaignID: string;
	user: FollowedSectionUser;
	content: FollowedSectionStream;
	sectionType: string;
	channelLabel: string;
};

export type FollowedSectionStream = {
	__typename: string;
	id: string;
	broadcaster: FollowedSectionUser;
	viewersCount: number;
	game: {
		__typename: string;
		id: string;
		slug: string;
		displayName: string;
		name: string;
	};
	type: string;
	hasHypeTrain: boolean;
};

export type FollowedSectionUser = {
	__typename: string;
	id: string;
	login: number;
	displayName: string;
	profileImageURL: string;
	primaryColorHex: string | null;
	broadcastSettings: {
		__typename: string;
		id: string;
		title: string;
	};
};

export type Chat = {
	props: {
		onSendMessage: (message: string) => void;
		channelID: string;
	};
};

export type TwitchChatCommand = {
	name: string;
	description: string;
	helpText: string;
	permissionLevel: number;
	handler: (song: string) => void;
	group?: string;
	commandArgs: {
		name: string;
		isRequired: boolean;
	}[];
};

export interface TwitchChatMessageComponent {
	channelLogin: string;
	channelID: string;
	message: {
		badges: Record<string, string>;
		id: string;
		message: string;
		user: {
			color: string;
			id: string;
			displayName: string;
			login: string;
		};
		nonce: string;
	};
}

export type ChatInputComponent = {
	state: {
		value: string;
	};
	componentRef: {
		props: {
			onChange: (event: { target: { value: string } }) => void;
		};
		focus: () => void;
	};
};

export type ScrollableChatComponent = {
	props: {
		currentUserLogin: string;
		channelID: string;
		children: HTMLElement[];
		focusEscape: () => void;
		messageHash: TwitchChatMessage[];
		setPaused: (paused: boolean) => void;
	};
};

export type ChatInfoComponent = {
	props: {
		channelLogin: string;
		channelID: string;
		sharedChatDataByChannelID: Map<string, UserChatInfo>;
	};
};

export type UserCardComponent = {
	props: {
		channelID: string;
		channelLogin: string;
		targetLogin: string;
	};
};

export type UserChatInfo = {
	displayName: string;
	login: string;
	profileImageURL: string;
	status: "ACTIVE" | "LEFT";
	primaryColorHex: string;
};

export type CurrentLiveStatusComponent = {
	props: {
		autoplay: boolean;
		isPlaying: boolean;
		isOffline: boolean;
		forbidden: boolean;
		isLive: boolean;
		liveContentChannelLogin: string;
		isVideoAdShowing: boolean;
	};
};

export type ChannelInfoComponent = {
	props: {
		channelLogin: string;
		channelName: string;
	};
};

export type ChannelInfoAlternativeComponent = {
	props: {
		channelID: string;
		channelLogin: string;
		displayName: string;
	};
};

export type ChannelInfo = {
	displayName: string;
	channelLogin: string;
	channelId?: string;
};

export type RootComponent = {
	value: {
		client: ApolloClient;
	};
};

export type ChatCommandStoreComponent = {
	value: ChatCommandStore;
};

export type ChatCommandStore = {
	addCommand: (command: TwitchChatCommand) => void;
	getCommands: () => string[];
};

export type ApolloClientFetchPolicy = "cache-first" | "network-only" | "no-cache" | "cache-only";

export type ApolloClient = {
	query: (params: {
		query: ReturnType<typeof gql>;
		variables?: Record<string, any>;
		fetchPolicy?: ApolloClientFetchPolicy;
	}) => Promise<Record<string, any>>;
};

export type GuestStarChannelGuestListUser = {
	id: string;
	login: string;
	displayName: string;
	profileImageURL: string;
	primaryColorHex: string | null;
	description: string;
};

export type GuestStarChannelGuestListSlot = {
	id: string;
	slotID: string;
	user: GuestStarChannelGuestListUser;
};

export type GuestStarChannelGuestListProps = {
	containerWidth: number;
	guestList: GuestStarChannelGuestListSlot[];
	isLive: boolean;
	requestQueueMessage: string | null;
	sessionID: string;
	channelLogin: string;
	channelID: string;
	currentUserID: string;
};

export type EmoteItem = { src: string; alt: string; isWide?: boolean };
