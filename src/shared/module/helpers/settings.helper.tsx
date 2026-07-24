import Settings, { SettingsOverlay } from "$shared/components/settings/settings.component.tsx";
import type { Logger } from "$shared/logger/logger.ts";
import type SettingsCache from "$shared/settings/settings.service.ts";
import type CommonUtils from "$shared/utils/common.utils.ts";
import type WorkerService from "$shared/worker/worker.service.ts";
import type { SettingCategory, SettingDefinition } from "$types/shared/components/settings.component.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { PlatformSettings } from "$types/shared/worker/settings-worker.types.ts";
import { type Signal, signal } from "@preact/signals";
import type { Emitter } from "nanoevents";
import { render } from "preact";

export class SettingsHelper<TSettings extends PlatformSettings> {
	private settingsSignal: Signal<TSettings> | null = null;
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

	loadSettings(defaults: TSettings): TSettings {
		try {
			const settings = { ...defaults, ...this.settingsCache.get() };
			if (this.settingsSignal) {
				this.settingsSignal.value = settings;
			}
			return settings;
		} catch (error) {
			this.logger.error("Failed to load settings:", error);
			return defaults;
		}
	}

	async saveSettings(settings: TSettings, updatedKey: keyof TSettings, eventPrefix: string): Promise<void> {
		try {
			await this.settingsCache.update(settings);
			if (this.settingsSignal) {
				this.settingsSignal.value = settings;
			}
			this.emitter.emit(`${String(eventPrefix)}${String(updatedKey)}`, settings[updatedKey]);
			this.logger.debug(`Settings changed "${String(updatedKey)}" to`, settings[updatedKey]);
		} catch (error) {
			this.logger.error("Failed to save settings:", error);
		}
	}

	async createSettingsContainer(props: {
		defaults: TSettings;
		categories: SettingCategory[];
		definitions: SettingDefinition<TSettings>[];
		eventPrefix: string;
	}): Promise<{
		settingsSignal: Signal<TSettings>;
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

		const onSettingsChange = (newSettings: TSettings, updatedKey: keyof TSettings) => {
			this.saveSettings(newSettings, updatedKey, props.eventPrefix);
		};

		const renderSettings = () => {
			if (this.settingsContainer && this.settingsSignal) {
				render(
					<SettingsOverlay style={{ display: this.isOpenSignal.value ? "flex" : "none" }}>
						<Settings
							logoSrc={logo}
							platform={this.platformType}
							isOpen={this.isOpenSignal.value}
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
