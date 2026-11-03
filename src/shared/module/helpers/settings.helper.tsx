import Settings, { SettingsOverlay } from "$shared/components/settings/settings.component.tsx";
import type { Logger } from "$shared/logger/logger.ts";
import { isGlobalSettingKey } from "$shared/settings/global-settings.constants.ts";
import type SettingsCache from "$shared/settings/settings.service.ts";
import type CommonUtils from "$shared/utils/common.utils.ts";
import type WorkerService from "$shared/worker/worker.service.ts";
import type {
	SettingCategory,
	SettingDefinition,
	SettingsIdentityRenderer,
} from "$types/shared/components/settings.component.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { GlobalSettings } from "$types/shared/settings/global-settings.types.ts";
import type { PlatformSettings } from "$types/shared/worker/settings-worker.types.ts";
import { type Signal, signal } from "@preact/signals";
import type { Emitter } from "nanoevents";
import { render } from "preact";

type PanelSettings<TSettings> = TSettings & GlobalSettings;

export class SettingsHelper<TSettings extends PlatformSettings> {
	private settingsSignal: Signal<PanelSettings<TSettings>> | null = null;
	private isOpenSignal: Signal<boolean> = signal(false);
	private settingsContainer: HTMLDivElement | null = null;

	constructor(
		private readonly platformType: PlatformType,
		private readonly settingsCache: SettingsCache<TSettings>,
		private readonly workerService: WorkerService,
		private readonly emitter: Emitter<any>,
		private readonly logger: Logger,
		private readonly commonUtils: CommonUtils,
	) {}

	loadSettings(defaults: TSettings): PanelSettings<TSettings> {
		try {
			const settings = { ...defaults, ...this.settingsCache.get(), ...this.settingsCache.getGlobal() };
			if (this.settingsSignal) {
				this.settingsSignal.value = settings;
			}
			return settings;
		} catch (error) {
			this.logger.error("Failed to load settings:", error);
			return defaults as PanelSettings<TSettings>;
		}
	}

	async saveSettings(
		settings: PanelSettings<TSettings>,
		updatedKey: keyof PanelSettings<TSettings>,
		eventPrefix: string,
		otherKeys: (keyof PanelSettings<TSettings>)[] = [],
	): Promise<void> {
		try {
			if (isGlobalSettingKey(updatedKey)) {
				await this.settingsCache.updateGlobal({ [updatedKey]: settings[updatedKey] });
				eventPrefix = "global:settings:";
			} else {
				const platformSettings: Record<string, unknown> = { ...settings };
				for (const key of Object.keys(platformSettings)) {
					if (isGlobalSettingKey(key)) delete platformSettings[key];
				}
				await this.settingsCache.update(platformSettings as TSettings);
			}
			if (this.settingsSignal) {
				this.settingsSignal.value = settings;
			}
			for (const key of [updatedKey, ...otherKeys]) {
				this.emitter.emit(`${String(eventPrefix)}${String(key)}`, settings[key]);
			}
			this.logger.debug(`Settings changed "${String(updatedKey)}" to`, settings[updatedKey]);
		} catch (error) {
			this.logger.error("Failed to save settings:", error);
		}
	}

	async createSettingsContainer(props: {
		defaults: PanelSettings<TSettings>;
		categories: SettingCategory[];
		definitions: SettingDefinition<PanelSettings<TSettings>>[];
		eventPrefix: string;
		identity?: SettingsIdentityRenderer;
		identityCategoryId?: string;
	}): Promise<{
		settingsSignal: Signal<PanelSettings<TSettings>>;
		isOpenSignal: Signal<boolean>;
		openSettings: () => void;
		closeSettings: () => void;
	}> {
		this.settingsSignal = signal(props.defaults);
		const wrapper = this.commonUtils.createElementByParent("enhancer-settings", "div", document.body);
		this.settingsContainer = wrapper as HTMLDivElement;

		const logo = await this.commonUtils.getAssetFile(
			this.workerService,
			"enhancer/logo.svg",
			"https://enhancer.at/assets/brand/logo.png",
		);

		const closeSettings = () => {
			this.isOpenSignal.value = false;
		};

		const onSettingsChange = (
			newSettings: PanelSettings<TSettings>,
			updatedKey: keyof PanelSettings<TSettings>,
			otherKeys?: (keyof PanelSettings<TSettings>)[],
		) => {
			this.saveSettings(newSettings, updatedKey, props.eventPrefix, otherKeys);
		};

		const renderSettings = () => {
			if (this.settingsContainer && this.settingsSignal) {
				render(
					<SettingsOverlay style={{ display: this.isOpenSignal.value ? "flex" : "none" }}>
						<Settings
							logoSrc={logo}
							platform={this.platformType}
							isOpen={this.isOpenSignal.value}
							identity={props.identity}
							identityCategoryId={props.identityCategoryId}
							categories={props.categories}
							settingDefinitions={props.definitions}
							settings={this.settingsSignal.value}
							onSettingsChange={onSettingsChange}
							onClose={closeSettings}
						/>
					</SettingsOverlay>,
					this.settingsContainer,
				);
			}
		};

		renderSettings();
		this.isOpenSignal.subscribe(renderSettings);
		this.settingsSignal.subscribe(renderSettings);

		return {
			settingsSignal: this.settingsSignal,
			isOpenSignal: this.isOpenSignal,
			openSettings: () => {
				this.isOpenSignal.value = true;
			},
			closeSettings,
		};
	}
}
