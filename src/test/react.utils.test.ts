import { expect, test } from "bun:test";
import ReactUtils from "$shared/utils/react.utils.ts";

type TestFiber = {
	child?: TestFiber | null;
	sibling?: TestFiber | null;
	return?: TestFiber | null;
	stateNode?: { props?: Record<string, unknown> } | null;
};

function createTree(): TestFiber {
	const target: TestFiber = { stateNode: { props: { mediaPlayerInstance: {} } } };
	const bare: TestFiber = { stateNode: {} };
	const leaf: TestFiber = { stateNode: null };
	const root: TestFiber = { child: bare };
	bare.return = root;
	bare.child = leaf;
	leaf.return = bare;
	leaf.sibling = target;
	target.return = bare;
	return root;
}

const reactUtils = new ReactUtils();

test("never calls the predicate with a nullish node", () => {
	const seen: unknown[] = [];

	reactUtils.findReactChildren(
		createTree(),
		(node) => {
			seen.push(node);
			return false;
		},
		50,
	);

	expect(seen.length).toBeGreaterThan(0);
	expect(seen.every((node) => node !== null && node !== undefined)).toBe(true);
});

test("findReactParents never calls the predicate with a nullish node", () => {
	const root = createTree();
	const leaf = root.child?.child as TestFiber;
	const seen: unknown[] = [];

	reactUtils.findReactParents(
		leaf,
		(node) => {
			seen.push(node);
			return false;
		},
		50,
	);

	expect(seen.length).toBeGreaterThan(0);
	expect(seen.every((node) => node !== null && node !== undefined)).toBe(true);
});

test("still finds a node reachable through siblings", () => {
	const found = reactUtils.findReactChildren<unknown>(
		createTree(),
		(node) => !!node?.stateNode?.props?.mediaPlayerInstance,
		50,
	);

	expect(found).not.toBeNull();
});

test("returns null for a nullish starting node", () => {
	expect(reactUtils.findReactChildren(null, () => true)).toBeNull();
	expect(reactUtils.findReactParents(undefined, () => true)).toBeNull();
});

test("keeps testing the node sitting exactly at the depth limit", () => {
	const deep: TestFiber = { stateNode: { props: { marker: true } } };
	const middle: TestFiber = { child: deep };
	const root: TestFiber = { child: middle };

	const found = reactUtils.findReactChildren<unknown>(root, (node) => !!node?.stateNode?.props?.marker, 2);

	expect(found).not.toBeNull();
});
