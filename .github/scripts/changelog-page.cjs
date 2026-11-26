const CHANGELOG_FEED = "https://changelog.enhancer.at/changelog.json";
const CHANGELOG_ORIGIN = "https://changelog.enhancer.at/";

/**
 * Returns the changelog page URL for a version, null when there is no entry,
 * or undefined when the feed could not be read.
 */
const findChangelogPage = async (version) => {
	const wanted = version.replace(/^v/, "");
	try {
		const response = await fetch(CHANGELOG_FEED, { headers: { Accept: "application/json" } });
		if (!response.ok) return undefined;
		const feed = await response.json();
		if (!Array.isArray(feed)) return undefined;
		const entry = feed.find((item) => item && item.version === wanted);
		return typeof entry?.url === "string" && entry.url.startsWith(CHANGELOG_ORIGIN) ? entry.url : null;
	} catch {
		return undefined;
	}
};

module.exports = { CHANGELOG_FEED, findChangelogPage };
