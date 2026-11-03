import { filterPlatformBadges, findShownGlobalBadge, groupBadgeSlots } from "$shared/enhancer-account/badge-slots.ts";
import { pickBadgeImage } from "$shared/utils/badge-image.utils.ts";
import type { EnhancerViewerBadges, EnhancerViewerSummary } from "$types/apis/enhancer-account.apis.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { EnhancerAccountCard, EnhancerAccountState } from "$types/shared/worker/enhancer-account-worker.types.ts";

export function buildAccountCard(
	account: EnhancerAccountState,
	profile: EnhancerViewerSummary | null,
	badges: EnhancerViewerBadges | null,
	platform: PlatformType,
): EnhancerAccountCard {
	if (!account.loggedIn) {
		return {
			loggedIn: false,
			displayName: null,
			avatarUrl: null,
			badgesLoaded: false,
			badgeName: null,
			badgeImageUrl: null,
		};
	}
	const user = profile?.user;
	const shown = badges ? findShownGlobalBadge(groupBadgeSlots(filterPlatformBadges(badges, platform))) : null;
	return {
		loggedIn: true,
		displayName: user?.displayName ?? user?.username ?? account.displayName ?? account.username ?? null,
		avatarUrl: user?.avatarUrl ?? null,
		badgesLoaded: badges !== null,
		badgeName: shown?.name ?? null,
		badgeImageUrl: shown ? pickBadgeImage(shown.sources) : null,
	};
}
