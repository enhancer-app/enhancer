import type { PlatformType } from "$types/shared/platform.types.ts";
import type { h, JSX } from "preact";

export type SettingCategoryPlacement = "main" | "utility";

export type SettingCategory<T = any> = {
	id: string;
	title: string;
	order: number;
	tags?: string[];
	placement?: SettingCategoryPlacement;
	hiddenInNav?: boolean;
	bare?: boolean;
	isVisible?: (settings: T) => boolean;
};

export type SettingDependency = {
	key: string;
	value?: unknown;
};

export type CommonSettingDefinition<T = any> = {
	id: keyof T | string;
	title: string;
	description: string;
	categoryId: string;
	tags?: string[];
	hint?: string;
	section?: string;
	hideInfo?: boolean;
	requiresRefreshToDisable?: boolean;
	dependsOn?: SettingDependency;
};

export type ToggleSettingDefinition<T = any> = {
	type: "toggle";
	confirmOnEnable?: boolean;
	confirmationTitle?: string;
	confirmationMessage?: string;
	confirmText?: string;
	confirmTone?: "default" | "danger";
	confirmationFacts?: SettingConfirmationFact[];
	confirmationNote?: string;
} & CommonSettingDefinition<T>;

export type InputSettingDefinition<T = any> = {
	type: "input";
	placeholder?: string;
} & CommonSettingDefinition<T>;

export type NumberSettingDefinition<T = any> = {
	type: "number";
	min?: number;
	max?: number;
	step?: number;
	unit?: string;
	slider?: boolean;
	onPreview?: (settings: T) => void;
	previewLabel?: string;
} & CommonSettingDefinition<T>;

export type PairSettingDefinition<T = any> = {
	type: "pair";
	keys: [keyof T & string, keyof T & string];
	min?: number;
	max?: number;
	step?: number;
	unit?: string;
	orderError?: string;
} & CommonSettingDefinition<T>;

export type ChoiceSettingDefinition<T = any> = {
	type: "choice";
	options: { label: string; value: Partial<T> }[];
} & CommonSettingDefinition<T>;

export type SelectSettingDefinition<T = any> = {
	type: "select";
	options: { value: any; label: string }[];
} & CommonSettingDefinition<T>;

export type RadioSettingDefinition<T = any> = {
	type: "radio";
	options: { value: any; label: string }[];
} & CommonSettingDefinition<T>;

export type ArraySettingDefinition<T = any> = {
	type: "array";
	arrayItemFields: ArrayItemField[];
	confirmOnRemove?: boolean;
	confirmationMessage?: string;
	reorderable?: boolean;
	defaultValue?: unknown[];
	variables?: string[];
	addLabel?: string;
	itemLabel?: string;
} & CommonSettingDefinition<T>;

export type TextSettingDefinition<T = any> = {
	type: "text";
	content: () => h.JSX.Element;
} & CommonSettingDefinition<T>;

export type FileSettingDefinition<T = any> = {
	type: "file";
	accept?: string;
	validTypes?: string[];
	maxSizeBytes?: number;
	fileNameKey?: keyof T & string;
	uploadedLabel?: string;
} & CommonSettingDefinition<T>;

export type SettingDefinition<T = any> =
	| ToggleSettingDefinition<T>
	| InputSettingDefinition<T>
	| NumberSettingDefinition<T>
	| SelectSettingDefinition<T>
	| RadioSettingDefinition<T>
	| ArraySettingDefinition<T>
	| TextSettingDefinition<T>
	| FileSettingDefinition<T>
	| PairSettingDefinition<T>
	| ChoiceSettingDefinition<T>;

export type SettingConfirmationFact = {
	term: string;
	detail: string;
};

export type ArrayItemField = {
	name: string;
	placeholder: string;
	validate?: "url";
	width?: "narrow" | "wide";
};

export type SettingsIdentityProps = {
	open: boolean;
	active: boolean;
	onSelect: () => void;
};

export type SettingsIdentityRenderer = (props: SettingsIdentityProps) => JSX.Element | null;

export type SettingsProps<T = any> = {
	logoSrc?: string;
	platform?: PlatformType;
	isOpen?: boolean;
	identity?: SettingsIdentityRenderer;
	identityCategoryId?: string;
	categories: SettingCategory[];
	settingDefinitions: SettingDefinition<T>[];
	settings: T;
	onSettingsChange: (settings: T, updatedKey: keyof T, otherKeys?: (keyof T)[]) => void;
	onClose?: () => void;
};

export type QuickAccessLink = {
	title: string;
	url: string;
};
