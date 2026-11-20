export class ChatMessageGroupingHelper {
	static readonly AUTHOR_ATTRIBUTE = "enhancer-group-author";
	static readonly GROUPED_CLASS = "enhancer-chat-grouped";

	private style?: HTMLStyleElement;

	constructor(private readonly hiddenSelectors: string[]) {}

	setEnabled(enabled: boolean) {
		if (!enabled) {
			this.style?.remove();
			return;
		}
		this.style ??= this.createStyle();
		document.head.appendChild(this.style);
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

	private createStyle() {
		const style = document.createElement("style");
		const selectors = this.hiddenSelectors
			.map((selector) => `.${ChatMessageGroupingHelper.GROUPED_CLASS} ${selector}`)
			.join(", ");
		style.id = "enhancer-chat-message-grouping";
		style.textContent = `${selectors} { display: none !important; }`;
		return style;
	}
}
