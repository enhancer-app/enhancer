import type { ChangelogNotifier } from "$shared/changelog/changelog.notifier.ts";

export type SettingsButtonComponentProps = {
	onClick: () => void;
	logoUrl: string;
	notifier: ChangelogNotifier;
};
