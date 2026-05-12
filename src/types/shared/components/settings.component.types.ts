import type { h } from "preact";

export type SettingCategory = {
	id: string;
	title: string;
	order: number;
	tags?: string[];
};

export type CommonSettingDefinition<T = any> = {
	id: keyof T | string;
	title: string;
	description: string;
	categoryId: string;
	tags?: string[];
	hideInfo?: boolean;
	requiresRefreshToDisable?: boolean;
};

export type ToggleSettingDefinition<T = any> = {
	type: "toggle";
	confirmOnEnable?: boolean;
	confirmationMessage?: string;
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
	arrayItemFields: { name: string; placeholder: string }[];
	confirmOnRemove?: boolean;
	confirmationMessage?: string;
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
} & CommonSettingDefinition<T>;

export type SettingDefinition<T = any> =
	| ToggleSettingDefinition<T>
	| InputSettingDefinition<T>
	| NumberSettingDefinition<T>
	| SelectSettingDefinition<T>
	| RadioSettingDefinition<T>
	| ArraySettingDefinition<T>
	| TextSettingDefinition<T>
	| FileSettingDefinition<T>;

export type SettingsProps<T = any> = {
	logoSrc?: string;
	categories: SettingCategory[];
	settingDefinitions: SettingDefinition<T>[];
	settings: T;
	onSettingsChange: (settings: T, updatedKey: keyof T) => void;
	onClose?: () => void;
};

export type QuickAccessLink = {
	title: string;
	url: string;
};
