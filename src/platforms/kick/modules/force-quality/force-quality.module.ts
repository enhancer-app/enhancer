import KickModule from "$kick/kick.module.ts";
import type { KickPlayerQuality } from "$types/platforms/kick/kick.utils.types.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";

export default class ForceQualityModule extends KickModule {
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
		if (this.appliedPath === path) return;

		const controller = this.kickUtils().getQualityController();
		if (!controller) return;

		const quality = this.selectQuality(controller.qualities);
		if (!quality) return;

		controller.setQuality(quality, false);
		this.appliedPath = path;
		this.logger.debug(`Forced stream quality to ${quality.name}`);
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

	// Kick gates the source rendition behind login and answers a forced switch with the login modal.
	private isQualityUnlocked(quality: KickPlayerQuality): boolean {
		if (quality.variantSource !== "source") return true;
		return this.kickUtils().isViewerAuthenticated() === true;
	}
}
