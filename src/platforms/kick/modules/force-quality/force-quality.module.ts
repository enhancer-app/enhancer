import KickModule from "$kick/kick.module.ts";
import type { KickPlayerQuality } from "$types/platforms/kick/kick.utils.types.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";

export default class ForceQualityModule extends KickModule {
	private static readonly QUALITY_PREFERENCE_KEY = "stream_quality";
	private static readonly LOGIN_GATED_HEIGHT = 1080;

	private appliedPath: string | null = null;

	readonly config: KickModuleConfig = {
		name: "force-quality",
		appliers: [
			{
				type: "selector",
				key: "force-quality",
				selectors: ["#injected-embedded-channel-player-video"],
				callback: this.run.bind(this),
				validateUrl: (url) => {
					return !url.includes("/videos/") && !url.includes("/clips/");
				},
			},
		],
		enabled: () => this.settings().forceQualityEnabled,
	};

	private run(): void {
		const path = window.location.pathname;
		if (this.appliedPath === path && !this.isPreferenceCleared()) return;

		const controller = this.kickUtils().getQualityController();
		if (!controller) return;

		const quality = this.selectQuality(controller.qualities);
		if (!quality) return;

		window.sessionStorage.setItem(ForceQualityModule.QUALITY_PREFERENCE_KEY, JSON.stringify(quality.height));
		controller.setQuality(quality, false);
		this.appliedPath = path;
		this.logger.debug(`Forced stream quality to ${quality.name}`);
	}

	// Kick restores this preference after every reload but clears heights of 1080 and above when switching live and DVR.
	private isPreferenceCleared(): boolean {
		return window.sessionStorage.getItem(ForceQualityModule.QUALITY_PREFERENCE_KEY) === "";
	}

	private selectQuality(qualities: KickPlayerQuality[]): KickPlayerQuality | null {
		const selectable = qualities
			.filter((quality) => quality.variantSource !== "auto" && this.isQualityUnlocked(quality))
			.sort((a, b) => b.height - a.height || b.bitrate - a.bitrate);
		if (selectable.length < 1) return null;

		const preferred = this.settings().forceQualityPreferred;
		if (preferred === "highest") return selectable[0];

		const maxHeight = Number.parseInt(preferred, 10);
		if (Number.isNaN(maxHeight)) return selectable[0];

		return selectable.find((quality) => quality.height <= maxHeight) ?? selectable[selectable.length - 1];
	}

	// Kick gates 1080p and above behind login and reverts a forced switch to Auto.
	private isQualityUnlocked(quality: KickPlayerQuality): boolean {
		if (Math.min(quality.width, quality.height) < ForceQualityModule.LOGIN_GATED_HEIGHT) return true;
		return this.kickUtils().isViewerAuthenticated() === true;
	}
}
