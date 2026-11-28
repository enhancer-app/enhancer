import { RuntimeWorkerClient } from "$shared/worker/runtime-worker.client.ts";
import type { PlatformSettings } from "$types/shared/worker/settings-worker.types.ts";
import type { GlobalSettings } from "$types/shared/settings/global-settings.types.ts";
import type { WelcomeFeature, WelcomeFeatureState, WelcomeSettingsSnapshot } from "$types/welcome/welcome.types.ts";

const client = new RuntimeWorkerClient();

export async function readFeatureState(features: WelcomeFeature[]): Promise<WelcomeSettingsSnapshot> {
	const [twitch, kick, global] = await Promise.all([
		client.send("getSettings", { platform: "twitch" }),
		client.send("getSettings", { platform: "kick" }),
		client.send("getGlobalSettings", {}),
	]);
	const platformSettings = { twitch, kick } as Record<string, Record<string, unknown> | null>;
	const followsSync = global?.crossPlatformFollowsSyncEnabled === true;
	const state: WelcomeFeatureState = {};
	for (const { id, setting, needsFollowsSync } of features) {
		state[id] =
			setting.scope === "global"
				? global?.[setting.key] === true && (!needsFollowsSync || followsSync)
				: setting.platforms.every((platform) => platformSettings[platform]?.[setting.key] === true);
	}
	return { state, followsSync };
}

export async function writeGlobalSettings(settings: Partial<GlobalSettings>): Promise<void> {
	await client.send("updateGlobalSettings", { settings });
}

export async function writeFeature({ setting }: WelcomeFeature, value: boolean): Promise<void> {
	if (setting.scope === "global") {
		await client.send("updateGlobalSettings", { settings: { [setting.key]: value } });
		return;
	}
	await Promise.all(
		setting.platforms.map((platform) =>
			client.send("updateSettings", {
				platform,
				changes: { [setting.key]: value } as Partial<PlatformSettings>,
			}),
		),
	);
}
