import type { SidebarChannel } from "$types/shared/components/cross-platform-follows.component.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { ChannelLinksTransport } from "$types/shared/utils/channel-links.types.ts";
import type { ChannelLink, ChannelLinksPayload } from "$types/shared/worker/channel-links-worker.types.ts";
import { useEffect, useState } from "preact/hooks";

export function useChannelLinks(transport: ChannelLinksTransport) {
	const [links, setLinks] = useState<ChannelLink[]>([]);

	useEffect(() => {
		let disposed = false;
		const handleLinks = (payload: ChannelLinksPayload) => {
			if (!disposed) setLinks(payload.links);
		};
		const unsubscribe = transport.subscribe(handleLinks);
		void transport.send("getChannelLinks", {}).then((payload) => payload && handleLinks(payload));
		return () => {
			disposed = true;
			unsubscribe();
		};
	}, [transport]);

	const replaceLinks = (next: ChannelLink[], request: Promise<ChannelLinksPayload | null>) => {
		setLinks(next);
		void request.then((payload) => payload && setLinks(payload.links));
	};

	const saveLink = (link: ChannelLink) =>
		replaceLinks(
			[...links.filter((item) => item.twitch !== link.twitch && item.kick !== link.kick), link],
			transport.send("updateChannelLink", link),
		);

	const link = (source: SidebarChannel, target: SidebarChannel, primary: PlatformType) => {
		const [twitch, kick] = source.platform === "twitch" ? [source, target] : [target, source];
		saveLink({ twitch: twitch.login, kick: kick.login, primary });
	};

	const prefer = (channel: SidebarChannel, primary: PlatformType) => {
		if (!channel.linked) return;
		const { twitch, kick } = channel.linked.channels;
		saveLink({ twitch: twitch.login, kick: kick.login, primary });
	};

	const unlink = (channel: SidebarChannel) => {
		if (!channel.linked) return;
		const { twitch, kick } = channel.linked.channels;
		replaceLinks(
			links.filter((item) => item.twitch !== twitch.login || item.kick !== kick.login),
			transport.send("removeChannelLink", { twitch: twitch.login, kick: kick.login }),
		);
	};

	return { links, link, prefer, unlink };
}
