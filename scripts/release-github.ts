import { spawnSync } from "node:child_process";

export const REPO = "enhancer-app/enhancer";
export const RELEASE_ENV = "release";
export const ANNOUNCE_ENV = "release-announce";
export const SYNC_ENV = "release-sync";
export const ANNOUNCE_CANARY_ENV = "release-announce-canary";
export const LEGACY_RELEASE_ENVS = ["release-stable", "release-canary"];
export const ENVIRONMENTS_URL = `https://github.com/${REPO}/settings/environments`;
export const RELEASE_APP_SLUG = "enhancer-release";
const MERGE_METHOD_SUFFIX = "-merge-method";

const REQUIRED_CHECKS = ["Lint & Format", "Tests", "Type Check", "Build Project", "Validate Pull Request Title"];

type Reviewer = { type: string; reviewer: { id: number } };

type Environment = {
	protection_rules?: {
		type: string;
		wait_timer?: number;
		prevent_self_review?: boolean;
		reviewers?: Reviewer[];
	}[];
};

type Rule = { type: string; parameters?: Record<string, unknown> };

type Ruleset = {
	id: number;
	name: string;
	enforcement: string;
	conditions: { ref_name: { include: string[]; exclude: string[] } };
	rules: Rule[];
	bypass_actors: { actor_id: number; actor_type: string; bypass_mode: string }[];
};

export function gh(args: string[], input?: string): string {
	const result = spawnSync("gh", args, { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
	if (result.status !== 0) throw new Error(`gh ${args.slice(0, 3).join(" ")} failed: ${result.stderr.trim()}`);
	return result.stdout;
}

export function api<T>(method: string, path: string, body?: object): T {
	const args = ["api", "-X", method, `repos/${REPO}/${path}`];
	if (body) args.push("--input", "-");
	const output = gh(args, body ? JSON.stringify(body) : undefined);
	return (output ? JSON.parse(output) : undefined) as T;
}

export function tryApi<T>(method: string, path: string): T | undefined {
	try {
		return api<T>(method, path);
	} catch {
		return undefined;
	}
}

export function allowActionsToCreatePullRequests(): void {
	const settings = api<{ default_workflow_permissions: string; can_approve_pull_request_reviews: boolean }>(
		"GET",
		"actions/permissions/workflow",
	);
	if (settings.can_approve_pull_request_reviews) {
		console.log("GitHub Actions can already create pull requests.");
		return;
	}
	api("PUT", "actions/permissions/workflow", {
		default_workflow_permissions: settings.default_workflow_permissions,
		can_approve_pull_request_reviews: true,
	});
	console.log("Allowed GitHub Actions to create pull requests.");
}

function configureEnvironment(name: string, branches: string[], requireReviewers: boolean): void {
	const current = tryApi<Environment>("GET", `environments/${name}`);
	const template =
		current ?? LEGACY_RELEASE_ENVS.map((legacy) => tryApi<Environment>("GET", `environments/${legacy}`)).find(Boolean);
	const rules = (requireReviewers ? template : current)?.protection_rules ?? [];
	const reviewersRule = rules.find((rule) => rule.type === "required_reviewers");
	const waitRule = rules.find((rule) => rule.type === "wait_timer");
	api("PUT", `environments/${name}`, {
		wait_timer: waitRule?.wait_timer ?? 0,
		prevent_self_review: reviewersRule?.prevent_self_review ?? false,
		reviewers: reviewersRule?.reviewers?.map(({ type, reviewer }) => ({ type, id: reviewer.id })) ?? null,
		deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
	});

	const { branch_policies: policies } = api<{ branch_policies: { id: number; name: string }[] }>(
		"GET",
		`environments/${name}/deployment-branch-policies`,
	);
	for (const policy of policies.filter((candidate) => !branches.includes(candidate.name))) {
		api("DELETE", `environments/${name}/deployment-branch-policies/${policy.id}`);
	}
	for (const branch of branches.filter((candidate) => !policies.some((policy) => policy.name === candidate))) {
		api("POST", `environments/${name}/deployment-branch-policies`, { name: branch, type: "branch" });
	}
	console.log(`Environment "${name}" deploys only from ${branches.join(" and ")}.`);

	if (requireReviewers && !reviewersRule?.reviewers?.length) {
		console.warn(`Environment "${name}" has no required reviewers. Add yourself: ${ENVIRONMENTS_URL}`);
	}
}

export function configureEnvironments(): void {
	configureEnvironment(RELEASE_ENV, ["stable", "canary"], true);
	configureEnvironment(ANNOUNCE_ENV, ["stable"], false);
	configureEnvironment(SYNC_ENV, ["master"], false);
	configureEnvironment(ANNOUNCE_CANARY_ENV, ["canary"], false);
}

export function legacyEnvironments(): string[] {
	return LEGACY_RELEASE_ENVS.filter((name) => tryApi("GET", `environments/${name}`));
}

export function deleteEnvironment(name: string): void {
	api("DELETE", `environments/${name}`);
	console.log(`Deleted environment "${name}".`);
}

function defaultBranchRuleset(): Ruleset {
	const summaries = api<{ id: number }[]>("GET", "rulesets");
	for (const { id } of summaries) {
		const ruleset = api<Ruleset>("GET", `rulesets/${id}`);
		if (ruleset.name.endsWith(MERGE_METHOD_SUFFIX)) continue;
		if (ruleset.conditions.ref_name.include.includes("~DEFAULT_BRANCH")) return ruleset;
	}
	throw new Error("No ruleset protects the default branch.");
}

function upsertRuleset(existing: Ruleset[], ruleset: Omit<Ruleset, "id"> & { target?: "branch" | "tag" }): void {
	const body = { target: "branch", ...ruleset };
	const current = existing.find((candidate) => candidate.name === ruleset.name);
	if (current) api("PUT", `rulesets/${current.id}`, body);
	else api("POST", "rulesets", body);
	console.log(`Ruleset "${ruleset.name}" is up to date.`);
}

function releaseAppActor(): Ruleset["bypass_actors"][number] {
	let id: number;
	try {
		id = (JSON.parse(gh(["api", `apps/${RELEASE_APP_SLUG}`])) as { id: number }).id;
	} catch {
		throw new Error(`Create the ${RELEASE_APP_SLUG} GitHub App and install it on ${REPO} first.`);
	}
	// GitHub rejects the app's merge commits on master unless its bypass is "always".
	return { actor_id: id, actor_type: "Integration", bypass_mode: "always" };
}

const methodOnly = (methods: string[]): Rule => ({
	type: "pull_request",
	parameters: {
		allowed_merge_methods: methods,
		dismiss_stale_reviews_on_push: false,
		require_code_owner_review: false,
		require_last_push_approval: false,
		required_approving_review_count: 0,
		required_review_thread_resolution: false,
	},
});

export function configureRulesets(): void {
	const app = releaseAppActor();
	const master = defaultBranchRuleset();
	const pullRequest = master.rules.find((rule) => rule.type === "pull_request");
	if (!pullRequest?.parameters) throw new Error(`Ruleset "${master.name}" has no pull request rule.`);
	const maintainers = master.bypass_actors.filter((actor) => actor.actor_id !== app.actor_id);

	api("PUT", `rulesets/${master.id}`, {
		name: master.name,
		target: "branch",
		enforcement: master.enforcement,
		conditions: master.conditions,
		bypass_actors: [...maintainers, app],
		rules: master.rules.map((rule) =>
			rule === pullRequest ? { ...rule, parameters: { ...rule.parameters, allowed_merge_methods: ["squash"] } } : rule,
		),
	});
	console.log(`Ruleset "${master.name}" lets ${RELEASE_APP_SLUG} merge the stable sync PR.`);

	const mergeOnly = { ...pullRequest, parameters: { ...pullRequest.parameters, allowed_merge_methods: ["merge"] } };
	const protect = [{ type: "deletion" }, { type: "non_fast_forward" }];
	const existing = api<Ruleset[]>("GET", "rulesets");
	upsertRuleset(existing, {
		name: `master${MERGE_METHOD_SUFFIX}`,
		enforcement: "active",
		conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
		bypass_actors: [app],
		rules: [methodOnly(["squash"])],
	});
	upsertRuleset(existing, {
		name: `release${MERGE_METHOD_SUFFIX}`,
		enforcement: "active",
		conditions: { ref_name: { include: ["refs/heads/stable", "refs/heads/canary"], exclude: [] } },
		bypass_actors: [],
		rules: [methodOnly(["merge"])],
	});
	upsertRuleset(existing, {
		name: "stable",
		enforcement: "active",
		conditions: { ref_name: { include: ["refs/heads/stable"], exclude: [] } },
		bypass_actors: maintainers,
		rules: [
			...protect,
			mergeOnly,
			{
				type: "required_status_checks",
				parameters: {
					strict_required_status_checks_policy: false,
					do_not_enforce_on_create: true,
					required_status_checks: REQUIRED_CHECKS.map((context) => ({ context, integration_id: 15368 })),
				},
			},
		],
	});
	upsertRuleset(existing, {
		name: "canary",
		enforcement: "active",
		conditions: { ref_name: { include: ["refs/heads/canary"], exclude: [] } },
		bypass_actors: maintainers,
		rules: [...protect, mergeOnly],
	});
	upsertRuleset(existing, {
		name: "release-tags",
		target: "tag",
		enforcement: "active",
		conditions: { ref_name: { include: ["refs/tags/v*", "refs/tags/canary-*"], exclude: [] } },
		bypass_actors: maintainers,
		rules: [{ type: "update" }, ...protect],
	});

	api("PUT", "immutable-releases");
	console.log("Immutable releases are enabled.");
}

export function ensureBranch(branch: string, sha: string): void {
	if (tryApi("GET", `git/ref/heads/${branch}`)) {
		console.log(`Branch ${branch} already exists.`);
		return;
	}
	api("POST", "git/refs", { ref: `refs/heads/${branch}`, sha });
	console.log(`Created branch ${branch} at ${sha.slice(0, 7)}.`);
}
