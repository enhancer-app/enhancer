import type { ReactComponent } from "$types/shared/utils/react.utils.types.ts";

export default class ReactUtils {
	findReactParents<StateNode, MemoizedProps = any, PendingProps = any>(
		node: any,
		predicate: (node: any) => boolean,
		maxDepth = 15,
		depth = 0,
	): ReactComponent<StateNode, MemoizedProps, PendingProps> | null {
		if (!node) return null;
		let success = false;
		try {
			success = predicate(node);
		} catch (_) {}
		if (success) return node;
		if (depth > maxDepth) return null;

		const { return: parent } = node;
		if (parent) {
			return this.findReactParents(parent, predicate, maxDepth, depth + 1);
		}

		return null;
	}

	findReactChildren<StateNode, MemoizedProps = any, PendingProps = any>(
		node: any,
		predicate: (node: any) => boolean,
		maxDepth = 15,
		depth = 0,
	): ReactComponent<StateNode, MemoizedProps, PendingProps> | null {
		if (!node) return null;
		let success = false;
		try {
			success = predicate(node);
		} catch (_) {}
		if (success) return node;
		if (depth > maxDepth) return null;

		const { child, sibling } = node;
		if (child || sibling) {
			return (
				this.findReactChildren(child, predicate, maxDepth, depth + 1) ||
				this.findReactChildren(sibling, predicate, maxDepth, depth + 1)
			);
		}

		return null;
	}

	getReactInstance(element: Element | Node | null) {
		for (const k in element) {
			if (k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$")) {
				return (element as any)[k];
			}
		}
	}

	getReactRoot(element: Element | Node | null) {
		for (const key in element) {
			if (key.startsWith("_reactRootContainer") || key.startsWith("__reactContainer$")) {
				return (element as any)[key];
			}
		}
	}
}
