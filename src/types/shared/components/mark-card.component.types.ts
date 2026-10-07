import type { MarksCardViewModel } from "$types/shared/marks-controller.types.ts";

export type MarkCardComponentProps = {
	controller: MarksCardViewModel;
};

export type MarkCompactComponentProps = MarkCardComponentProps & {
	expand: () => void;
};
