export class ChatMessageGroupingHelper {
	static readonly AUTHOR_ATTRIBUTE = "enhancer-group-author";
	static readonly GROUPED_CLASS = "enhancer-chat-grouped";

	private readonly style = document.createElement("style");

	constructor(hiddenSelectors: string[]) {
		const selectors = hiddenSelectors
			.map((selector) => `.${ChatMessageGroupingHelper.GROUPED_CLASS} ${selector}`)
			.join(", ");
		this.style.id = "enhancer-chat-message-grouping";
		this.style.textContent = `${selectors} { display: none !important; }`;
	}

	setEnabled(enabled: boolean) {
		if (enabled) document.head.appendChild(this.style);
		else this.style.remove();
	}

	markRow(row: Element, author: string, canGroup: boolean) {
		row.setAttribute(ChatMessageGroupingHelper.AUTHOR_ATTRIBUTE, canGroup ? author : `${author}:solo`);
	}

	updateRow(row: Element | null | undefined, previous: Element | null | undefined) {
		if (!row) return;
		const author = row.getAttribute(ChatMessageGroupingHelper.AUTHOR_ATTRIBUTE);
		const previousAuthor = previous?.getAttribute(ChatMessageGroupingHelper.AUTHOR_ATTRIBUTE)?.replace(/:solo$/, "");
		const grouped = !!author && !author.endsWith(":solo") && author === previousAuthor;
		row.classList.toggle(ChatMessageGroupingHelper.GROUPED_CLASS, grouped);
	}
}
