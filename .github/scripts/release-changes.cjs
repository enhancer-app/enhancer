const PICKED_PATTERN = /^\(cherry picked from commit ([0-9a-f]{40})\)$/m;
const RELEASE_PATTERN = /^release(\([^)]*\))?!?:/i;
const PAGE_SIZE = 100;

const compareCommits = async (github, owner, repo, from, to) => {
	const commits = [];
	for (let page = 1; ; page++) {
		const { data } = await github.rest.repos.compareCommitsWithBasehead({
			owner,
			repo,
			basehead: `${from}...${to}`,
			per_page: PAGE_SIZE,
			page,
		});
		commits.push(...data.commits);
		if (data.commits.length < PAGE_SIZE || commits.length >= data.total_commits) return commits;
	}
};

const collectChanges = async ({ github, context, from, to }) => {
	const { owner, repo } = context.repo;
	const master = context.payload.repository.default_branch;
	const changes = [];
	const seen = new Set();

	for (const commit of await compareCommits(github, owner, repo, from, to)) {
		if (commit.parents.length > 1) continue;
		const message = commit.commit.message;
		const subject = message.split("\n")[0];
		const source = message.match(PICKED_PATTERN)?.[1] ?? commit.sha;
		const { data: pulls } = await github.rest.repos.listPullRequestsAssociatedWithCommit({
			owner,
			repo,
			commit_sha: source,
		});
		const merged = pulls.filter((pull) => pull.merged_at);
		const pull = merged.find((candidate) => candidate.base.ref === master) ?? merged[0];

		if (pull) {
			if (seen.has(pull.number) || RELEASE_PATTERN.test(pull.title)) continue;
			seen.add(pull.number);
			changes.push({
				title: pull.title,
				number: pull.number,
				author: pull.user?.login,
				url: pull.html_url,
				body: pull.body ?? "",
			});
		} else if (!RELEASE_PATTERN.test(subject)) {
			changes.push({ title: subject, sha: source, body: "" });
		}
	}
	return changes;
};

const formatNotes = ({ changes, context, fromTag, toTag }) => {
	const { owner, repo } = context.repo;
	const lines = changes.map((change) =>
		change.number
			? `* ${change.title} by @${change.author} in ${change.url}`
			: `* ${change.title} (${change.sha.slice(0, 7)})`,
	);
	return [
		"## What's Changed",
		...(lines.length ? lines : ["* Maintenance release"]),
		"",
		...(fromTag ? [`**Full Changelog**: https://github.com/${owner}/${repo}/compare/${fromTag}...${toTag}`] : []),
	].join("\n");
};

module.exports = { collectChanges, formatNotes };
