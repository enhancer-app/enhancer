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
	subscriber_badges: SubscriberBadge[];
	banner_image: { url: string } | null;
	livestream: Livestream | null;
	role: string | null;
	muted: boolean;
	follower_badges: any[];
	offline_banner_image: string | null;
	verified: boolean;
	recent_categories: RecentCategory[];
	can_host: boolean;
	user: User;
	chatroom: Chatroom;
}

export interface SubscriberBadge {
	id: number;
	channel_id: number;
	months: number;
	badge_image: {
		srcset: string;
		src: string;
	};
}

export interface LivestreamCategory {
	id: number;
	category_id: number;
	name: string;
	slug: string;
	tags: string[];
	description: string | null;
	deleted_at: string | null;
	is_mature: boolean;
	is_promoted: boolean;
	viewers: number;
	is_fallback: boolean;
	category: {
		id: number;
		name: string;
		slug: string;
		icon: string;
	};
}

export interface Livestream {
	id: number;
	slug: string;
	channel_id: number;
	created_at: string;
	session_title: string;
	is_live: boolean;
	risk_level_id: number | null;
	start_time: string;
	source: string | null;
	twitch_channel: string | null;
	duration: number;
	language: string;
	is_mature: boolean;
	viewer_count: number;
	thumbnail: { url: string };
	lang_iso: string;
	tags: string[];
	categories: LivestreamCategory[];
}

export interface RecentCategory {
	id: number;
	category_id: number;
	name: string;
	slug: string;
	tags: string[];
	description: string | null;
	deleted_at: string | null;
	is_mature: boolean;
	is_promoted: boolean;
	viewers: number;
	is_fallback: boolean;
	banner: { responsive: string; url: string };
	category: { id: number; name: string; slug: string; icon: string };
}

export interface User {
	id: number;
	username: string;
	agreed_to_terms: boolean;
	email_verified_at: string;
	bio: string;
	country: string;
	state: string;
	city: string;
	instagram: string;
	twitter: string;
	youtube: string;
	discord: string;
	tiktok: string;
	facebook: string;
	profile_pic: string;
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
}

export interface FollowedChannelsResponse {
	nextCursor?: number | null;
	channels?: FollowedChannel[];
}
