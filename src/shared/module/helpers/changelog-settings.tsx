import type { ChangelogNotifier } from "$shared/changelog/changelog.notifier.ts";
import { ChangelogResetButton } from "$shared/components/changelog/changelog-notice.component.tsx";
import type { SettingDefinition } from "$types/shared/components/settings.component.types.ts";

export function createChangelogSettings<T>(categoryId: string, notifier: ChangelogNotifier): SettingDefinition<T>[] {
	return [
		{
			id: "whatsNewEnabled",
			title: "Show what's new",
			description: "Marks the settings button with a dot when a new Enhancer version has release notes.",
			type: "toggle",
			categoryId,
			section: "Updates",
			tags: ["Changelog", "Release notes", "Update notification"],
		},
		{
			id: "whatsNewShowAgain",
			title: "Show the latest changelog again",
			description: "Brings back the dot and the notice for the newest release notes.",
			type: "text",
			categoryId,
			section: "Updates",
			tags: ["Changelog", "Release notes"],
			content: () => <ChangelogResetButton notifier={notifier} />,
		},
	];
}
