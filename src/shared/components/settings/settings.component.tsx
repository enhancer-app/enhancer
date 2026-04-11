import type {
	SettingCategory,
	SettingDefinition,
	SettingsProps,
} from "$types/shared/components/settings.component.types.ts";
import { h } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import styled from "styled-components";

const SettingsContainer = styled.div`
	display: flex;
	flex-direction: column;
	width: 800px;
	height: 500px;
	background-color: #0d0d0d;
	border-radius: 15px;
	border: 1px solid #232323;
	position: relative;
	font-family: "Inter", "Noto Sans Arabic", "Roobert", "Helvetica Neue", Helvetica, Arial, sans-serif !important;
`;

const Gradient = styled.div`
	position: absolute;
	top: 0;
	left: 0;
	height: 100%;
	width: 100%;
	z-index: 999;
	border-radius: 15px;
	pointer-events: none;
	mix-blend-mode: hard-light;
	background: radial-gradient(
		circle 400px at 5% 8%,
		rgba(155, 89, 182, 0.3),
		transparent
	);
`;

const Header = styled.header`
	display: flex;
	align-items: center;
	padding: 12px 20px;
	color: white;
	font-size: 14px;
	border-bottom: 1px solid #161616;
	gap: 12px;
	height: 52px;
	box-sizing: border-box;
`;

const LogoContainer = styled.div`
	width: 35px;
	height: 35px;
	display: flex;
	justify-content: center;
	align-items: center;
	border-radius: 7px;
	box-shadow: inset 0px 1px 0px 0px #333333;
	background: linear-gradient(to bottom, #282728 5%, #1c1d1f 100%);
	flex-shrink: 0;
	align-self: center;
`;

const Logo = styled.img`
	width: 25px;
	height: 25px;
`;

const SearchContainer = styled.div`
	flex: 1;
	display: flex;
	align-items: center;
	background: #161616;
	border: 1px solid #232323;
	border-radius: 7px;
	padding: 0 10px;
	transition: border-color 0.2s;
	height: 35px;
	box-sizing: border-box;

	&:focus-within {
		border-color: #9147ff;
	}
`;

const SearchInput = styled.input`
	flex: 1;
	background: none;
	border: none;
	color: white;
	font-size: 12px;
	padding: 0;
	outline: none;
	height: 100%;

	&::placeholder {
		color: #565656;
	}
`;

const ClearButton = styled.button`
	background: none;
	border: none;
	cursor: pointer;
	color: #565656;
	padding: 4px;
	display: flex;
	align-items: center;
	justify-content: center;
	align-self: center;

	&:hover {
		color: white;
	}
`;

const CategoryJumpButton = styled.button`
	background: transparent;
	border: none;
	color: #565656;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 4px;
	margin-left: auto;
	border-radius: 4px;
	flex-shrink: 0;

	&:hover {
		color: #9147ff;
		background: rgba(145, 71, 255, 0.1);
	}
`;

const CategoryDropdown = styled.div<{ visible: boolean }>`
	position: absolute;
	top: calc(100% + 5px);
	right: 0;
	background: #161616;
	border: 1px solid #232323;
	border-radius: 7px;
	min-width: 150px;
	max-height: 200px;
	overflow-y: auto;
	z-index: 1000;
	display: ${(props) => (props.visible ? "block" : "none")};

	&::-webkit-scrollbar {
		width: 6px;
	}

	&::-webkit-scrollbar-thumb {
		background: #333333;
		border-radius: 3px;
	}
`;

const CategoryDropdownItem = styled.button`
	display: block;
	width: 100%;
	background: none;
	border: none;
	color: #ccc;
	font-size: 12px;
	padding: 10px 12px;
	text-align: left;
	cursor: pointer;

	&:hover {
		background: #232323;
		color: white;
	}
`;

const CloseButton = styled.button`
	background: none;
	border: none;
	cursor: pointer;
	color: #565656;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	align-self: center;

	&:hover {
		color: white;
	}
`;

const SettingsContent = styled.div`
	overflow-y: auto;
	flex: 1;

	&::-webkit-scrollbar {
		width: 8px;
	}

	&::-webkit-scrollbar-track {
		background: #0d0d0d;
		border-radius: 4px;
	}

	&::-webkit-scrollbar-thumb {
		background: #232323;
		border-radius: 4px;
		border: 1px solid #161616;
	}

	&::-webkit-scrollbar-thumb:hover {
		background: #2a2a2a;
	}

	scrollbar-width: thin;
	scrollbar-color: #232323 #0d0d0d;
`;

const CategoryHeader = styled.div`
	position: sticky;
	top: 0;
	padding: 12px 20px 10px 20px;
	font-size: 12px;
	font-weight: 600;
	color: #9147ff;
	text-transform: uppercase;
	letter-spacing: 0.5px;
	background: #0d0d0d;
	z-index: 10;
	display: flex;
	align-items: center;
`;

const CategorySettings = styled.div`
	padding: 0 20px;
	border-top: 1px solid #232323;
`;

const Setting = styled.div`
	display: flex;
	padding: 15px 0;
	border-bottom: 1px solid #1a1a1a;
	justify-content: space-between;
	align-items: center;
	gap: 20px;

	&:last-child {
		border-bottom: none;
	}
`;

const SettingInfo = styled.div`
	flex: 1;
`;

const SettingTitle = styled.div`
	font-size: 14px;
	color: white;
	margin-bottom: 4px;
`;

const SettingDescription = styled.div`
	color: rgb(131 122 122);
	font-size: 12px;
`;

const RefreshWarning = styled.div`
	color: #ed5959;
	font-size: 12px;
	margin-top: 4px;
	display: flex;
	align-items: center;
	gap: 4px;
`;

const SettingControl = styled.div`
	flex-shrink: 0;
`;

const ToggleContainer = styled.div`
	display: inline-block;
	position: relative;
	width: 50px;
	height: 25px;
`;

const ToggleInput = styled.input`
	display: none;
`;

const ToggleSwitch = styled.label<{ checked: boolean }>`
	position: absolute;
	cursor: pointer;
	background-color: ${(props) => (props.checked ? "#9147ff" : "#232323")};
	border-radius: 25px;
	width: 100%;
	height: 100%;
	transition: background-color 0.3s;
`;

const ToggleCircle = styled.span<{ checked: boolean }>`
	position: absolute;
	top: 3px;
	left: ${(props) => (props.checked ? "28px" : "5px")};
	width: 18px;
	height: 18px;
	background-color: #fff;
	border-radius: 50%;
	transition: left 0.3s;
`;

const TextInput = styled.input`
	background: none;
	border: 1px solid #232323;
	color: white;
	font-size: 11px;
	border-radius: 7px;
	padding: 10px;
	min-width: 200px;
`;

const NumberInput = styled(TextInput)`
	min-width: 100px;
`;

const FileInputContainer = styled.div`
	background: #0d0d0d;
	border: 1px solid #232323;
	border-radius: 7px;
	padding: 4px;
	min-width: 200px;
	min-height: 38px;
	display: flex;
	align-items: center;
	position: relative;
	transition: border-color 0.2s ease;

	&:hover {
		border-color: #333333;
	}
`;

const UploadTriggerLabel = styled.label`
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	width: 100%;
	height: 100%;
	color: white;
	font-size: 12px;
	font-weight: 500;
	cursor: pointer;
	padding: 6px;
	border-radius: 5px;
	transition: background-color 0.2s ease;

	svg {
		width: 16px;
		height: 16px;
		color: #9147ff;
	}

	&:hover {
		background: #232323;
	}
`;

const FileStatus = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;
	flex: 1;
	padding-left: 8px;
	color: #ccc;
	font-size: 11px;

	svg {
		color: #9147ff;
		flex-shrink: 0;
	}
`;

const FileName = styled.span`
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
`;

const HiddenFileInput = styled.input`
	display: none;
`;

const RemoveFileButton = styled.button`
	background: transparent;
	border: none;
	color: #565656;
	cursor: pointer;
	padding: 4px;
	height: 28px;
	width: 28px;
	border-radius: 5px;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: all 0.2s ease;
	margin-left: auto;

	&:hover {
		background: rgba(255, 71, 87, 0.1);
		color: #ff4757;
	}
`;

const FileUploadError = styled.div`
	color: #ff4757;
	font-size: 11px;
	margin-top: 6px;
	padding: 6px 8px;
	background: rgba(255, 71, 87, 0.1);
	border-radius: 5px;
	border-left: 2px solid #ff4757;
	text-align: center;
`;

const Select = styled.select`
	background: #0d0d0d;
	padding: 10px;
	border-radius: 7px;
	color: #565656;
	border: 1px solid #232323;
	font-size: 11px;
	cursor: pointer;
	min-width: 150px;
`;

const RadioContainer = styled.div`
	display: flex;
	gap: 10px;
	flex-wrap: wrap;
`;

const RadioInput = styled.input`
	display: none;
`;

const RadioLabel = styled.label<{ checked: boolean }>`
	background: ${(props) => (props.checked ? "#9147ff" : "#232323")};
	padding: 10px;
	border-radius: 7px;
	color: ${(props) => (props.checked ? "white" : "#565656")};
	cursor: pointer;
`;

const ArrayContainer = styled.div`
	display: flex;
	flex-direction: column;
	gap: 10px;
	min-width: 200px;
`;

const ArrayItem = styled.div`
	display: flex;
	gap: 10px;
	align-items: center;
`;

const ArrayInput = styled(TextInput)`
	min-width: 150px;
`;

const ArrayButton = styled.button<{ variant: "add" | "remove" }>`
	background: ${(props) => (props.variant === "add" ? "#9147ff" : "#ff4757")};
	border: none;
	color: white;
	padding: 8px 12px;
	border-radius: 5px;
	cursor: pointer;
	font-size: 12px;
`;

const TextContent = styled.div`
	color: #ccc;
	line-height: 1.6;
	max-width: 500px;
`;

const ModalOverlay = styled.div`
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background: rgba(0, 0, 0, 0.7);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 1001;
	backdrop-filter: blur(4px);
`;

const ModalContent = styled.div`
	background-color: #0d0d0d;
	border-radius: 15px;
	border: 1px solid #232323;
	font-family: "Inter", "Noto Sans Arabic", "Roobert", "Helvetica Neue", Helvetica, Arial, sans-serif !important;
	padding: 25px;
	box-shadow: 0px 5px 15px rgba(0, 0, 0, 0.5);
	max-width: 500px;
	width: 90%;
`;

const ModalHeader = styled.h3`
	color: white;
	margin-bottom: 15px;
	font-size: 18px;
	text-align: center;
`;

const ModalMessage = styled.p`
	color: #ccc;
	font-size: 14px;
	margin-bottom: 20px;
	line-height: 1.5;
`;

const ModalButtonContainer = styled.div`
	display: flex;
	justify-content: flex-end;
	gap: 10px;
	margin-top: 20px;
`;

const ModalButton = styled.button<{ primary?: boolean }>`
	padding: 8px 15px;
	border-radius: 5px;
	font-size: 12px;
	cursor: pointer;
	border: none;
	transition: background-color 0.2s ease, color 0.2s ease;
	${(props) =>
		props.primary
			? `
    background-color: #9147ff;
    color: white;
    &:hover {
      background-color: #7a3cc8;
    }
  `
			: `
    background-color: #232323;
    color: #ccc;
    &:hover {
      background-color: #333333;
    }
  `}
`;

const NoResults = styled.div`
	padding: 40px 20px;
	text-align: center;
	color: #565656;
	font-size: 14px;
`;

function tokenize(text: string): string[] {
	return text.toLowerCase().split(/\s+/).filter(Boolean);
}

function matchesQuery(text: string, query: string): boolean {
	const textTokens = tokenize(text);
	const queryTokens = tokenize(query);
	return queryTokens.every((qt) => textTokens.some((tt) => tt.includes(qt)));
}

const Settings = <T,>({
	logoSrc = "Logo.svg",
	categories,
	settingDefinitions,
	settings,
	onSettingsChange,
	onClose = () => {},
}: SettingsProps<T>) => {
	const [searchQuery, setSearchQuery] = useState("");
	const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
	const [pendingToggle, setPendingToggle] = useState<{
		key: keyof T;
		value: boolean;
		confirmationMessage?: string;
	} | null>(null);

	const [pendingArrayRemove, setPendingArrayRemove] = useState<{
		key: keyof T;
		index: number;
		itemTitle?: string;
		confirmationMessage?: string;
	} | null>(null);

	const [justTurnedOff, setJustTurnedOff] = useState<keyof T | null>(null);
	const [fileUploadError, setFileUploadError] = useState<string | null>(null);

	const contentRef = useRef<HTMLDivElement>(null);
	const categoryRefs = useRef<Map<string, HTMLDivElement>>(new Map());

	const updateSetting = (key: keyof T, value: unknown) => {
		const newSettings = { ...settings, [key]: value };
		onSettingsChange(newSettings, key);
	};

	const updateArraySetting = (key: keyof T, index: number, value: unknown, action: "update" | "add" | "remove") => {
		const currentArray = settings[key] as unknown[];
		let newArray: unknown[];

		switch (action) {
			case "update":
				newArray = currentArray.map((item, i) => (i === index ? value : item));
				break;
			case "add":
				newArray = [...currentArray, value];
				break;
			case "remove":
				newArray = currentArray.filter((_, i) => i !== index);
				break;
			default:
				return;
		}

		updateSetting(key, newArray);
	};

	const handleFileChange = (event: Event, setting: SettingDefinition<T>) => {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		if (!file) return;

		setFileUploadError(null);

		if (setting.type === "file" && setting.validTypes && setting.validTypes.length > 0) {
			if (!setting.validTypes.includes(file.type)) {
				const errorMsg = "Invalid file type.";
				setFileUploadError(errorMsg);
				target.value = "";
				return;
			}
		}

		if (setting.type === "file" && setting.maxSizeBytes && setting.maxSizeBytes > 0) {
			if (file.size > setting.maxSizeBytes) {
				const maxSizeMB = (setting.maxSizeBytes / 1024 / 1024).toFixed(2);
				const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
				const errorMsg = `File size (${fileSizeMB}MB) exceeds maximum allowed size of ${maxSizeMB}MB.`;
				setFileUploadError(errorMsg);
				target.value = "";
				return;
			}
		}

		const reader = new FileReader();
		reader.onload = (e) => {
			const result = e.target?.result as string;
			updateSetting(setting.id as keyof T, result);
		};
		reader.onerror = () => {
			const errorMsg = "Failed to read the selected file. Please try again.";
			setFileUploadError(errorMsg);
		};
		reader.readAsDataURL(file);
		target.value = "";
	};

	const clearFile = (settingId: keyof T) => {
		updateSetting(settingId, "");
		setFileUploadError(null);
	};

	const handleToggleChange = (event: Event, setting: SettingDefinition<T>, checked: boolean) => {
		event.stopPropagation();

		if (setting.type === "toggle" && setting.confirmOnEnable && checked) {
			setPendingToggle({
				key: setting.id as keyof T,
				value: checked,
				confirmationMessage: setting.confirmationMessage ?? "Are you sure you want to enable this setting?",
			});
		} else {
			updateSetting(setting.id as keyof T, checked);
			setPendingToggle(null);

			if (setting.requiresRefreshToDisable && settings[setting.id as keyof T] === true && !checked) {
				setJustTurnedOff(setting.id as keyof T);
				setTimeout(() => {
					setJustTurnedOff((current) => (current === setting.id ? null : current));
				}, 5000);
			} else if (checked && justTurnedOff === setting.id) {
				setJustTurnedOff(null);
			}
		}
	};

	const confirmToggle = () => {
		if (pendingToggle) {
			updateSetting(pendingToggle.key, pendingToggle.value);
			setPendingToggle(null);
		}
	};

	const cancelToggle = () => {
		setPendingToggle(null);
	};

	const handleArrayRemove = (setting: SettingDefinition<T>, index: number, item: unknown) => {
		if (setting.type === "array" && setting.confirmOnRemove) {
			const itemTitle =
				typeof item === "object" && item !== null && "title" in item && typeof item.title === "string"
					? item.title
					: "";
			setPendingArrayRemove({
				key: setting.id as keyof T,
				index,
				itemTitle,
				confirmationMessage: setting.confirmationMessage,
			});
		} else {
			updateArraySetting(setting.id as keyof T, index, null, "remove");
		}
	};

	const confirmArrayRemove = () => {
		if (pendingArrayRemove) {
			updateArraySetting(pendingArrayRemove.key, pendingArrayRemove.index, null, "remove");
			setPendingArrayRemove(null);
		}
	};

	const cancelArrayRemove = () => {
		setPendingArrayRemove(null);
	};

	const jumpToCategory = (categoryId: string) => {
		const element = categoryRefs.current.get(categoryId);
		if (element) {
			element.scrollIntoView({ behavior: "smooth", block: "start" });
		}
		setShowCategoryDropdown(false);
	};

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as HTMLElement;
			if (!target.closest(".category-jump-container")) {
				setShowCategoryDropdown(false);
			}
		};
		document.addEventListener("click", handleClickOutside);
		return () => document.removeEventListener("click", handleClickOutside);
	}, []);

	const renderSettingControl = (setting: SettingDefinition<T>) => {
		const value = settings[setting.id as keyof T];

		switch (setting.type) {
			case "toggle": {
				return (
					<ToggleContainer>
						<ToggleInput
							type="checkbox"
							id={setting.id as string}
							checked={value as boolean}
							onChange={(e) => handleToggleChange(e, setting, (e.target as HTMLInputElement).checked)}
						/>
						<ToggleSwitch
							htmlFor={setting.id as string}
							checked={value as boolean}
							onClick={(e) => e.stopPropagation()}
						>
							<ToggleCircle checked={value as boolean} />
						</ToggleSwitch>
					</ToggleContainer>
				);
			}
			case "input": {
				return (
					<TextInput
						value={(value as string) || ""}
						placeholder={setting.placeholder}
						onChange={(e) => updateSetting(setting.id as keyof T, (e.target as HTMLInputElement).value)}
					/>
				);
			}
			case "number": {
				return (
					<NumberInput
						type="number"
						value={(value as number) || 0}
						min={setting.min}
						max={setting.max}
						step={setting.step}
						onChange={(e) => updateSetting(setting.id as keyof T, Number((e.target as HTMLInputElement).value))}
					/>
				);
			}
			case "select": {
				return (
					<Select
						value={value as string}
						onChange={(e) => updateSetting(setting.id as keyof T, (e.target as HTMLSelectElement).value)}
					>
						{setting.options?.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</Select>
				);
			}
			case "radio": {
				return (
					<RadioContainer>
						{setting.options?.map((option) => (
							<div key={option.value}>
								<RadioInput
									type="radio"
									name={setting.id as string}
									id={`${setting.id as string}-${option.value}`}
									checked={value === option.value}
									onChange={() => updateSetting(setting.id as keyof T, option.value)}
								/>
								<RadioLabel htmlFor={`${setting.id as string}-${option.value}`} checked={value === option.value}>
									{option.label}
								</RadioLabel>
							</div>
						))}
					</RadioContainer>
				);
			}
			case "array": {
				const arrayValue = (value as unknown[]) || [];
				const fields = setting.arrayItemFields || [{ name: "page", placeholder: "Enter value..." }];

				return (
					<ArrayContainer>
						{arrayValue.map((item, index) => (
							<ArrayItem key={`array-item-${setting.id as string}-${index}`}>
								{fields.map((field: { name: string; placeholder: string }) => (
									<ArrayInput
										key={`${setting.id as string}-${index}-${field.name}`}
										value={
											typeof item === "object" && item !== null
												? (item as Record<string, string>)[field.name] || ""
												: String(item)
										}
										placeholder={field.placeholder}
										onChange={(e) => {
											const newValue =
												typeof item === "object" && item !== null
													? { ...(item as Record<string, unknown>), [field.name]: (e.target as HTMLInputElement).value }
													: { [field.name]: (e.target as HTMLInputElement).value };
											updateArraySetting(setting.id as keyof T, index, newValue, "update");
										}}
									/>
								))}
								<ArrayButton variant="remove" onClick={() => handleArrayRemove(setting, index, item)}>
									Remove
								</ArrayButton>
							</ArrayItem>
						))}
						<ArrayButton
							variant="add"
							onClick={() => {
								const newValue = fields.reduce(
									(acc: Record<string, string>, field: { name: string; placeholder: string }) => {
										acc[field.name] = "";
										return acc;
									},
									{},
								);
								updateArraySetting(setting.id as keyof T, arrayValue.length, newValue, "add");
							}}
						>
							Add Item
						</ArrayButton>
					</ArrayContainer>
				);
			}
			case "text": {
				try {
					const Component = setting.content;
					return <Component />;
				} catch (e) {
					console.error("Enhancer Error when rendering component", e);
				}
				return null;
			}
			case "file": {
				const fileValue = value as string;
				const hasFile = fileValue && fileValue.length > 0;

				return (
					<>
						<FileInputContainer>
							{hasFile ? (
								<>
									<FileStatus>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
											strokeLinecap="round"
											strokeLinejoin="round"
										>
											<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
										</svg>
										<FileName>File uploaded</FileName>
									</FileStatus>
									<RemoveFileButton onClick={() => clearFile(setting.id as keyof T)} title="Remove file">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
											strokeLinecap="round"
											strokeLinejoin="round"
										>
											<path stroke="none" d="M0 0h24v24H0z" fill="none" />
											<path d="M18 6l-12 12" />
											<path d="M6 6l12 12" />
										</svg>
									</RemoveFileButton>
								</>
							) : (
								<UploadTriggerLabel htmlFor={`file-${setting.id as string}`}>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
										<polyline points="17 8 12 3 7 8" />
										<line x1="12" y1="3" x2="12" y2="15" />
									</svg>
									Upload File
									<HiddenFileInput
										id={`file-${setting.id as string}`}
										type="file"
										accept={setting.accept || "audio/*"}
										onChange={(e) => handleFileChange(e, setting)}
									/>
								</UploadTriggerLabel>
							)}
						</FileInputContainer>
						{fileUploadError && <FileUploadError>{fileUploadError}</FileUploadError>}
					</>
				);
			}
			default:
				return null;
		}
	};

	const filteredCategories = useMemo(() => {
		const sortedCategories = [...categories].sort((a, b) => a.order - b.order);

		if (!searchQuery.trim()) {
			return sortedCategories.map((category) => ({
				...category,
				settings: settingDefinitions.filter((s) => s.categoryId === category.id),
			}));
		}

		return sortedCategories
			.map((category) => {
				const matchingSettings = settingDefinitions.filter((setting) => {
					if (setting.categoryId !== category.id) return false;

					const searchText = [setting.title, setting.description, String(setting.id), ...(setting.tags || [])].join(
						" ",
					);

					const categorySearchText = [category.title, ...(category.tags || [])].join(" ");

					return matchesQuery(searchText, searchQuery) || matchesQuery(categorySearchText, searchQuery);
				});

				return {
					...category,
					settings: matchingSettings,
				};
			})
			.filter((category) => category.settings.length > 0);
	}, [categories, settingDefinitions, searchQuery]);

	const visibleCategoryIds = useMemo(() => new Set(filteredCategories.map((c) => c.id)), [filteredCategories]);

	return (
		<>
			<SettingsOverlayBackground onClick={onClose} />
			<SettingsContainer>
				<Gradient />
				<Header>
					<LogoContainer>
						<Logo src={logoSrc} alt="logo" />
					</LogoContainer>
					<SearchContainer>
						<SearchInput
							type="text"
							placeholder="Search settings..."
							value={searchQuery}
							onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
						/>
						{searchQuery && (
							<ClearButton onClick={() => setSearchQuery("")}>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<path stroke="none" d="M0 0h24v24H0z" fill="none" />
									<path d="M18 6l-12 12" />
									<path d="M6 6l12 12" />
								</svg>
							</ClearButton>
						)}
					</SearchContainer>
					<CloseButton onClick={onClose}>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path stroke="none" d="M0 0h24v24H0z" fill="none" />
							<path d="M18 6l-12 12" />
							<path d="M6 6l12 12" />
						</svg>
					</CloseButton>
				</Header>
				<SettingsContent ref={contentRef}>
					{filteredCategories.length === 0 ? (
						<NoResults>No settings found matching "{searchQuery}"</NoResults>
					) : (
						filteredCategories.map((category, index) => (
							<div
								key={category.id}
								ref={(el) => {
									if (el) categoryRefs.current.set(category.id, el);
								}}
							>
								<CategoryHeader>
									{category.title}
									{index === 0 && (
										<CategoryJumpButton
											className="category-jump-container"
											onClick={(e) => {
												e.stopPropagation();
												setShowCategoryDropdown(!showCategoryDropdown);
											}}
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="14"
												height="14"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												strokeWidth="2"
												strokeLinecap="round"
												strokeLinejoin="round"
											>
												<path d="M3 6h18" />
												<path d="M3 12h18" />
												<path d="M3 18h18" />
											</svg>
											<CategoryDropdown visible={showCategoryDropdown}>
												{filteredCategories.map((c) => (
													<CategoryDropdownItem key={c.id} onClick={() => jumpToCategory(c.id)}>
														{c.title}
													</CategoryDropdownItem>
												))}
											</CategoryDropdown>
										</CategoryJumpButton>
									)}
								</CategoryHeader>
								<CategorySettings>
									{category.settings.map((setting) => {
										const value = settings[setting.id as keyof T];
										if (setting.hideInfo) {
											return (
												<Setting
													key={`setting-${setting.id as string}`}
													style={{ flexDirection: "column", alignItems: "stretch" }}
												>
													<SettingControl style={{ flexShrink: "unset" }}>
														{renderSettingControl(setting)}
													</SettingControl>
												</Setting>
											);
										}
										return (
											<Setting key={`setting-${setting.id as string}`}>
												<SettingInfo>
													<SettingTitle>{setting.title}</SettingTitle>
													<SettingDescription>{setting.description}</SettingDescription>
													{setting.requiresRefreshToDisable && justTurnedOff === setting.id && (
														<RefreshWarning>
															Disabling this feature requires a page refresh to fully take effect.
														</RefreshWarning>
													)}
												</SettingInfo>
												<SettingControl>{renderSettingControl(setting)}</SettingControl>
											</Setting>
										);
									})}
								</CategorySettings>
							</div>
						))
					)}
				</SettingsContent>
			</SettingsContainer>
			{pendingToggle && (
				<ModalOverlay onClick={cancelToggle}>
					<ModalContent onClick={(e) => e.stopPropagation()}>
						<ModalHeader>Confirm Action</ModalHeader>
						<ModalMessage>
							{pendingToggle.confirmationMessage || "Are you sure you want to enable this setting?"}
						</ModalMessage>
						<ModalButtonContainer>
							<ModalButton primary onClick={confirmToggle}>
								Confirm
							</ModalButton>
							<ModalButton onClick={cancelToggle}>Cancel</ModalButton>
						</ModalButtonContainer>
					</ModalContent>
				</ModalOverlay>
			)}
			{pendingArrayRemove && (
				<ModalOverlay onClick={cancelArrayRemove}>
					<ModalContent onClick={(e) => e.stopPropagation()}>
						<ModalHeader>Confirm Removal</ModalHeader>
						<ModalMessage>
							{pendingArrayRemove.confirmationMessage ||
								(pendingArrayRemove.itemTitle
									? `Are you sure you want to remove "${pendingArrayRemove.itemTitle}"?`
									: "Are you sure you want to remove this item?")}
						</ModalMessage>
						<ModalButtonContainer>
							<ModalButton primary onClick={confirmArrayRemove}>
								Remove
							</ModalButton>
							<ModalButton onClick={cancelArrayRemove}>Cancel</ModalButton>
						</ModalButtonContainer>
					</ModalContent>
				</ModalOverlay>
			)}
		</>
	);
};

export default Settings;

const SettingsOverlayBackground = styled.div`
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: -1;
`;

export const SettingsOverlay = styled.div`
	position: fixed;
	top: 0;
	left: 0;
	width: 100vw;
	height: 100vh;
	background: rgba(0, 0, 0, 0.8);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 10000;
	backdrop-filter: blur(4px);
`;
