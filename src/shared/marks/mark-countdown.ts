export type MarkCountdown = {
	ended: boolean;
	text: string;
};

export function formatMarkCountdown(endsAt: string, now = Date.now()): MarkCountdown {
	const remaining = Date.parse(endsAt) - now;
	if (Number.isNaN(remaining) || remaining <= 0) return { ended: true, text: "Ended" };
	const totalSeconds = Math.ceil(remaining / 1000);
	if (totalSeconds < 60) return { ended: false, text: `${totalSeconds}s left` };
	const totalMinutes = Math.floor(totalSeconds / 60);
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	if (hours === 0) return { ended: false, text: `${minutes}m left` };
	return { ended: false, text: minutes > 0 ? `${hours}h ${minutes}m left` : `${hours}h left` };
}

export function remainingRatio(startedAt: string, endsAt: string, now = Date.now()): number | null {
	const start = Date.parse(startedAt);
	const end = Date.parse(endsAt);
	if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
	return Math.min(1, Math.max(0, (end - now) / (end - start)));
}

export function pickBadgeImage(sources: Record<string, string>): string | null {
	const preferred = sources["4x"] || sources["2x"] || sources["1x"];
	if (preferred) return preferred;
	let best: { size: number; url: string } | null = null;
	for (const [key, url] of Object.entries(sources)) {
		if (!url) continue;
		const size = Number.parseInt(key, 10) || 0;
		if (!best || size > best.size) best = { size, url };
	}
	return best?.url ?? null;
}
