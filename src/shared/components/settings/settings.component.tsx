import { h } from "preact";
import { useState } from "preact/hooks";
import styled from "styled-components";
import type { SettingDefinition, SettingsProps } from "$types/shared/components/settings.component.types.ts";

const SettingsContainer = styled.div`
	display: flex;
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

const Aside = styled.aside`
	width: 75px;
	display: flex;
	flex-direction: column;
	border-right: 1px solid #161616;
`;

const LogoContainer = styled.div`
	width: 35px;
	height: 35px;
	display: flex;
	justify-content: center;
	align-items: center;
	margin: 20px;
	border-radius: 7px;
	box-shadow: inset 0px 1px 0px 0px #333333;
	background: linear-gradient(to bottom, #282728 5%, #1c1d1f 100%);
`;

const Logo = styled.img`
	width: 25px;
	height: 25px;
`;

const TabIcon = styled.img<{ active: boolean }>`
	width: 20px;
	height: 20px;
	filter: ${(props) => (props.active ? "brightness(0) invert(1)" : "brightness(0) invert(0.4)")};
	transition: filter 0.3s ease;
`;

const Tabs = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	flex: 1;
	padding: 20px 0;
	gap: 15px;
`;

const Tab = styled.button<{ active: boolean; isLast: boolean }>`
	display: flex;
	justify-content: center;
	align-items: center;
	border: none;
	width: 35px;
	height: 35px;
	border-radius: 7px;
	background: ${(props) => (props.active ? "rgba(145, 71, 255, 0.2)" : "none")};
	cursor: pointer;
	color: ${(props) => (props.active ? "#9147ff" : "#565656")};
	margin-top: ${(props) => (props.isLast ? "auto" : "0")};

	&:not(.active):hover {
		background: #232323;
	}

	&:hover ${TabIcon} {
		filter: brightness(0) invert(0.7)
	}
`;

const Main = styled.main`
	width: 100%;
	display: flex;
	flex-direction: column;
`;

const Header = styled.header`
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 15px;
	color: white;
	font-size: 14px;
	border-bottom: 1px solid #161616;
`;

const CloseButton = styled.button`
	background: none;
	border: none;
	cursor: pointer;
	color: #565656;
`;

const SettingsContent = styled.div`
	overflow-y: auto;

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

const Setting = styled.div`
	display: flex;
	padding: 20px;
	border-bottom: 1px solid #232323;
	justify-content: space-between;
	align-items: center;
	gap: 20px;
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
	font-size: 14px;
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
	color: white; /* Changed text color to white */
	font-size: 12px;
	font-weight: 500;
	cursor: pointer;
	padding: 6px;
	border-radius: 5px;
	transition: background-color 0.2s ease;

	svg {
		width: 16px;
		height: 16px;
		color: #9147ff; /* Icon remains purple */
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

const Settings = <T,>({
	logoSrc = "Logo.svg",
	tabs,
	settingDefinitions,
	settings,
	onSettingsChange,
	onClose = () => {},
}: SettingsProps<T>) => {
	const [activeTab, setActiveTab] = useState(0);
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

		// Clear any previous error
		setFileUploadError(null);

		// Validate file type if validTypes are specified
		if (setting.type === "file" && setting.validTypes && setting.validTypes.length > 0) {
			if (!setting.validTypes.includes(file.type)) {
				const errorMsg = "Invalid file type.";
				setFileUploadError(errorMsg);
				console.error(`Invalid file type: ${file.type}. Allowed types: ${setting.validTypes.join(", ")}`);
				target.value = "";
				return;
			}
		}

		// Validate file size if maxSizeBytes is specified
		if (setting.type === "file" && setting.maxSizeBytes && setting.maxSizeBytes > 0) {
			if (file.size > setting.maxSizeBytes) {
				const maxSizeMB = (setting.maxSizeBytes / 1024 / 1024).toFixed(2);
				const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
				const errorMsg = `File size (${fileSizeMB}MB) exceeds maximum allowed size of ${maxSizeMB}MB.`;
				setFileUploadError(errorMsg);
				console.error(errorMsg);
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
			console.error("Failed to read file for setting:", setting.id, reader.error);
		};
		reader.readAsDataURL(file);
		target.value = "";
	};

	const clearFile = (settingId: keyof T) => {
		updateSetting(settingId, "");
		setFileUploadError(null); // Clear error when file is removed
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
		// Check if this array setting requires confirmation on remove
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
			// For array types without confirmation, remove directly
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

	const currentTabSettings = settingDefinitions.filter((setting) => setting.tabIndex === activeTab);

	return (
		<>
			<SettingsOverlayBackground onClick={onClose} />
			<SettingsContainer>
				<Gradient />
				<Aside>
					<LogoContainer>
						<Logo src={logoSrc} alt="logo" />
					</LogoContainer>
					<Tabs>
						{tabs.map((tab, index) => (
							<Tab
								key={`tab-${tab.title}-${index}`}
								active={activeTab === index}
								isLast={index === tabs.length - 1}
								onClick={() => setActiveTab(index)}
							>
								<TabIcon src={tab.iconUrl} alt={`${tab.title} icon`} active={activeTab === index} />
							</Tab>
						))}
					</Tabs>
				</Aside>
				<Main>
					<Header>
						<h4>{tabs[activeTab]?.title || "Settings"}</h4>
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
					<SettingsContent>
						{currentTabSettings.map((setting) => {
							const value = settings[setting.id as keyof T];
							if (setting.hideInfo) {
								return (
									<Setting
										key={`setting-${setting.id as string}`}
										style={{ flexDirection: "column", alignItems: "stretch" }}
									>
										<SettingControl style={{ flexShrink: "unset" }}>{renderSettingControl(setting)}</SettingControl>
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
					</SettingsContent>
				</Main>
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
