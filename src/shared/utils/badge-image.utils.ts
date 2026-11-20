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
