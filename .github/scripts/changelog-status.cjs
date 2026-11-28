const { CHANGELOG_FEED, findChangelogPage } = require("./changelog-page.cjs");

const MARKER = "<!-- changelog-status -->";
const RELEASE_TITLE = /^release\(stable\): v(\d+\.\d+\.\d+)$/;

const renderStatus = (version, url) =>
	url
		? [MARKER, "> [!NOTE]", `> Changelog ready: [What's new in ${version}](${url})`].join("\n")
		: [MARKER, "> [!CAUTION]", "> This release does not have a changelog page yet."].join("\n");

// Keeps one comment per stable release PR and edits it in place.
module.exports = async ({ github, context, core }) => {
	const { owner, repo } = context.repo;
	const pulls = await github.paginate(github.rest.pulls.list, { owner, repo, state: "open", base: "stable" });

	for (const pull of pulls) {
		const version = RELEASE_TITLE.exec(pull.title)?.[1];
		if (!version) continue;

		const url = await findChangelogPage(version);
		if (url === undefined) {
			core.warning(`Could not read ${CHANGELOG_FEED}; #${pull.number} keeps its current status.`);
			continue;
		}

		const body = renderStatus(version, url);
		const comments = await github.paginate(github.rest.issues.listComments, {
			owner,
			repo,
			issue_number: pull.number,
		});
		const existing = comments.find((comment) => comment.user?.type === "Bot" && comment.body?.startsWith(MARKER));
		if (existing?.body === body) {
			core.info(`#${pull.number} v${version}: unchanged.`);
		} else if (existing) {
			await github.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body });
			core.info(`#${pull.number} v${version}: updated (${url ? "ready" : "missing"}).`);
		} else {
			await github.rest.issues.createComment({ owner, repo, issue_number: pull.number, body });
			core.info(`#${pull.number} v${version}: created (${url ? "ready" : "missing"}).`);
		}
	}
};

module.exports.renderStatus = renderStatus;
