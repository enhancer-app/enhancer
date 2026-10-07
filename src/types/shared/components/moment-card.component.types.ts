import type { MomentsCardViewModel } from "$types/shared/moments-controller.types.ts";

export type MomentCardComponentProps = {
	controller: MomentsCardViewModel;
};

export type MomentCompactComponentProps = MomentCardComponentProps & {
	expand: () => void;
};
