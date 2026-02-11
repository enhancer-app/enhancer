export interface ChannelResponse {
	id: number;
	user_id: number;
	slug: string;
	is_banned: boolean;
	playback_url: string;
	vod_enabled: boolean;
	subscription_enabled: boolean;
	is_affiliate: boolean;
	followers_count: number;
	subscriber_badges: any[];
	livestream: any;
	role: string;
	muted: boolean;
	follower_badges: any[];
	offline_banner_image: any;
	verified: boolean;
	recent_categories: any[];
	can_host: boolean;
	user: User;
	chatroom: Chatroom;
	channel_users: any[];
	channel_actions: any[];
}

export interface User {
	id: number;
	username: string;
	agreed_to_terms: boolean;
	email_verified_at: string;
	bio: string;
	country: any;
	state: any;
	city: any;
	instagram: string;
	twitter: string;
	youtube: string;
	discord: string;
	tiktok: string;
	facebook: string;
	profile_pic: any;
}

export interface Chatroom {
	id: number;
	chatable_type: string;
	channel_id: number;
	created_at: string;
	updated_at: string;
	chat_mode_old: string;
	chat_mode: string;
	slow_mode: boolean;
	chatable_id: number;
	followers_mode: boolean;
	subscribers_mode: boolean;
	emotes_mode: boolean;
	message_interval: number;
	following_min_duration: number;
}

export interface FollowedChannel {
	channel_slug?: string | null;
	user_username?: string | null;
	profile_picture?: string | null;
}

export interface FollowedChannelsResponse {
	nextCursor?: number | null;
	channels?: FollowedChannel[];
}
