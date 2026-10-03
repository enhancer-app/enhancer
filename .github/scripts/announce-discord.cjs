const USER_FACING_TYPES = new Set(["feat", "fix", "bugfix"]);
const PLATFORM_SCOPES = { twitch: "Twitch", kick: "Kick" };
const TITLE_PATTERN = /^(\w+)(?:\(([^)]+)\))?!?:\s*(.+)$/;
const NOTHING_USER_FACING = "- Bug fixes and stability improvements";
const MAX_MESSAGE_LENGTH = 2000;

const SYSTEM_PROMPT = `You write release notes for Enhancer, a browser extension for Twitch and Kick viewers.
Readers are regular viewers, not developers.

Rules:
- Only include changes a viewer can notice. Skip CI, build, refactoring, tests, docs and internal tooling.
- Describe what the viewer gets, in plain words and second person ("You can now…", "… no longer …").
- Never mention PR numbers, authors, commit types, file or module names.
- Keep names users know: Twitch, Kick, 7TV, BetterTTV, FrankerFaceZ.
- Group bullets under these headings, omitting empty ones: **New**, **Improved**, **Fixed**.
- Prefix a bullet with "Twitch:" or "Kick:" when it applies to only one platform.
- One short sentence per bullet. Maximum 1700 characters in total.
- Do not invent details, add an introduction, or add a Changelog heading.
- If nothing is user-facing, return exactly: ${NOTHING_USER_FACING}

Example input:
- feat(kick): add force stream quality module
  Description: Lets viewers lock Kick streams to a chosen quality instead of auto.
- fix(twitch): preserve 7TV badges after confirmation
- ci(release): migrate Chrome publishing to API v2

Example output:
**New**
- Kick: You can now lock streams to your preferred quality so they no longer switch automatically.

**Fixed**
- Twitch: 7TV badges no longer disappear after confirming a message.`;

const parseTitle = (title) => {
	const match = title.match(TITLE_PATTERN);
	if (!match) return { type: "", scope: undefined, subject: title };
	return { type: match[1].toLowerCase(), scope: match[2]?.toLowerCase(), subject: match[3] };
};

const extractDescription = (body) => {
	const section = (body ?? "").match(/^#{2,3}\s*(?:Description|Summary)\s*\n([\s\S]*?)(?=\n#{1,3}\s|$)/im)?.[1] ?? "";
	return section
		.replace(/<!--[\s\S]*?-->/g, "")
		.replace(/^\s*_.*_\s*$/gm, "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 600);
};

const fallbackNotes = (changes) => {
	const bullets = changes
		.filter((change) => USER_FACING_TYPES.has(change.type))
		.map((change) => {
			const platform = PLATFORM_SCOPES[change.scope];
			const subject = change.subject.charAt(0).toUpperCase() + change.subject.slice(1);
			return `- ${platform ? `${platform}: ` : ""}${subject}`;
		});
	return bullets.length ? bullets.join("\n") : NOTHING_USER_FACING;
};

const summarize = async (changes, version, core) => {
	const input = changes
		.map((change) => (change.description ? `- ${change.title}\n  Description: ${change.description}` : `- ${change.title}`))
		.join("\n");

	const response = await fetch("https://api.llmgateway.io/v1/chat/completions", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${process.env.LLM_GATEWAY_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: process.env.LLM_GATEWAY_MODEL,
			messages: [
				{ role: "system", content: SYSTEM_PROMPT },
				{ role: "user", content: `Changes in ${version}:\n${input}` },
			],
			temperature: 0.3,
			max_tokens: 4000,
			reasoning_effort: "low",
			stream: false,
		}),
	});

	if (!response.ok) {
		core.warning(`LLM Gateway request failed with status ${response.status}. Using the fallback changelog.`);
		return null;
	}

	const choice = (await response.json()).choices?.[0];
	const content = choice?.message?.content?.trim();
	core.info(`LLM finish_reason=${choice?.finish_reason}, length=${content?.length ?? 0}`);
	if (!content) {
		core.warning("LLM Gateway returned an empty summary. Using the fallback changelog.");
		return null;
	}
	return content.replace(/^\s*\*\*Changelog[^*]*\*\*\s*/i, "").trim();
};

module.exports = async ({ github, context, core }) => {
	for (const name of ["DISCORD_CHANGELOG_WEBHOOK", "LLM_GATEWAY_API_KEY", "LLM_GATEWAY_MODEL", "VERSION"]) {
		if (!process.env[name]) {
			core.setFailed(`Missing required environment variable: ${name}`);
			return;
		}
	}
	core.setSecret(process.env.DISCORD_CHANGELOG_WEBHOOK);
	core.setSecret(process.env.LLM_GATEWAY_API_KEY);

	const { owner, repo } = context.repo;
	const version = process.env.VERSION;
	const release = await github.rest.repos.getReleaseByTag({ owner, repo, tag: version });
	const pullNumbers = [...new Set([...(release.data.body ?? "").matchAll(/\/pull\/(\d+)/g)].map((m) => Number(m[1])))];

	const changes = [];
	for (const pull_number of pullNumbers) {
		const { data } = await github.rest.pulls.get({ owner, repo, pull_number });
		const parsed = parseTitle(data.title);
		if (parsed.type === "release") continue;
		changes.push({ ...parsed, title: data.title, description: extractDescription(data.body) });
	}
	core.info(`Summarizing ${changes.length} pull requests.`);

	const notes = (changes.length && (await summarize(changes, version, core))) || fallbackNotes(changes);
	let message = `**Changelog ${version}**\n\n${notes}`;
	if (message.length > MAX_MESSAGE_LENGTH) message = `${message.slice(0, MAX_MESSAGE_LENGTH - 3)}...`;
	core.info(message);

	const discordResponse = await fetch(process.env.DISCORD_CHANGELOG_WEBHOOK, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username: "Enhancer Releases", allowed_mentions: { parse: [] }, content: message }),
	});
	if (!discordResponse.ok) throw new Error(`Discord webhook failed with status ${discordResponse.status}.`);
};
