export type MomentCountdown = {
	ended: boolean;
	text: string;
};

export function formatMomentCountdown(endsAt: string, now = Date.now()): MomentCountdown {
	const remaining = Date.parse(endsAt) - now;
	if (Number.isNaN(remaining) || remaining <= 0) return { ended: true, text: "Ended" };
	const totalSeconds = Math.floor(remaining / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	const body =
		hours > 0
			? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
			: `${minutes}:${String(seconds).padStart(2, "0")}`;
	return { ended: false, text: `${body} left` };
}

export function pickBadgeImage(sources: Record<string, string>): string | null {
	const preferred = sources["4x"] || sources["2x"] || sources["1x"];
	if (preferred) return preferred;
	for (const url of Object.values(sources)) if (url) return url;
	return null;
}
