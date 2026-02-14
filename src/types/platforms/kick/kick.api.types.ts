// ── Channel Response (v2 API: /api/v2/channels/{slug}) ──

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

// ── Followed Channels ──

export interface FollowedChannel {
	channel_slug?: string | null;
	user_username?: string | null;
	profile_picture?: string | null;
}

export interface FollowedChannelsResponse {
	nextCursor?: number | null;
	channels?: FollowedChannel[];
}

// ── Channel Profile (v1 API: /api/v1/channels/{slug}) ──

export interface KickChannelProfile {
	id: number;
	user_id: number;
	slug: string;
	is_banned: boolean;
	playback_url: string;
	name_updated_at: string | null;
	vod_enabled: boolean;
	subscription_enabled: boolean;
	is_affiliate: boolean;
	followersCount: number;
	subscriber_badges: KickSubscriberBadge[];
	banner_image: KickBannerImage | null;
	recent_categories: KickRecentCategory[];
	livestream: KickLivestream | null;
	role: string | null;
	muted: boolean;
	follower_badges: unknown[];
	offline_banner_image: KickOfflineBannerImage | null;
	can_host: boolean;
	user: KickUser;
	chatroom: KickChatroom;
	ascending_links: KickAscendingLink[];
	plan: KickPlan | null;
	previous_livestreams: KickPreviousLivestream[];
	verified: KickVerifiedStatus | null;
	media: KickMedia[];
}

export interface KickSubscriberBadge {
	id: number;
	channel_id: number;
	months: number;
	badge_image: {
		srcset: string;
		src: string;
	};
}

export interface KickBannerImage {
	responsive: string;
	url: string;
}

export interface KickOfflineBannerImage {
	src: string;
	srcset: string;
}

export interface KickCategoryIcon {
	id: number;
	name: string;
	slug: string;
	icon: string;
}

export interface KickCategoryBanner {
	responsive: string;
	url: string;
}

export interface KickRecentCategory {
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
	banner: KickCategoryBanner;
	category: KickCategoryIcon;
}

export interface KickThumbnail {
	responsive: string;
	url: string;
}

export interface KickLivestream {
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
	thumbnail: KickThumbnail | null;
	viewers: number;
	lang_iso: string;
	tags: string[];
	categories: KickRecentCategory[];
}

export interface KickUser {
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
	gender: string | null;
	profile_pic: string;
}

export interface KickChatroom {
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

export interface KickAscendingLink {
	id: number;
	channel_id: number;
	description: string;
	link: string;
	created_at: string;
	updated_at: string;
	order: number;
	title: string;
}

export interface KickPlan {
	id: number;
	channel_id: number;
	stripe_plan_id: string;
	amount: string;
	created_at: string;
	updated_at: string;
}

export interface KickVideo {
	id: number;
	live_stream_id: number;
	slug: string | null;
	thumb: string | null;
	s3: string | null;
	trading_platform_id: string | null;
	created_at: string;
	updated_at: string;
	uuid: string;
	views: number;
	deleted_at: string | null;
	is_pruned: boolean;
	is_private: boolean;
	status: string;
}

export interface KickPreviousLivestream extends KickLivestream {
	video: KickVideo;
	views: number;
}

export interface KickVerifiedStatus {
	id: number;
	channel_id: number;
	created_at: string;
	updated_at: string;
}

export interface KickMedia {
	id: number;
	model_type: string;
	model_id: number;
	collection_name: string;
	name: string;
	file_name: string;
	mime_type: string;
	disk: string;
	size: number;
	manipulations: Record<string, unknown> | unknown[];
	custom_properties: {
		generated_conversions?: Record<string, boolean>;
		[key: string]: unknown;
	};
	responsive_images: Record<string, unknown> | unknown[];
	order_column: number;
	created_at: string;
	updated_at: string;
	uuid: string;
	conversions_disk: string;
}
