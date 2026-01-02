import SharedStorageService from "$shared/storage/shared-storage.service.ts";
import type WorkerService from "$shared/worker/worker.service.ts";
import type { ChatMonitorStorageData } from "$types/shared/storage/chat-monitor-storage.types.ts";
import { useEffect, useState } from "preact/hooks";
import styled from "styled-components";

const Container = styled.div`
	padding: 0;
	line-height: 1.6;
	color: #ccc;
	width: 100%;
	max-width: none;
`;

const Header = styled.div`
	padding: 20px 30px;
	background: linear-gradient(135deg, rgba(145, 71, 255, 0.1) 0%, rgba(145, 71, 255, 0.05) 100%);
	border-radius: 12px;
	border: 1px solid rgba(145, 71, 255, 0.2);
	margin-bottom: 20px;
`;

const Title = styled.h2`
	color: #9147ff;
	margin: 0 0 8px 0;
	font-size: 18px;
	font-weight: 700;
`;

const Description = styled.p`
	color: #999;
	margin: 0;
	font-size: 12px;
	line-height: 1.5;
`;

const Section = styled.div`
	background: rgba(255, 255, 255, 0.02);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 12px;
	padding: 20px;
	margin-bottom: 20px;
`;

const SectionTitle = styled.h3`
	color: #9147ff;
	margin: 0 0 16px 0;
	font-size: 14px;
	font-weight: 600;
`;

const ToggleContainer = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 20px;
`;

const ToggleLabel = styled.label`
	display: flex;
	align-items: center;
	cursor: pointer;
	user-select: none;
`;

const ToggleSwitch = styled.div<{ checked: boolean }>`
	position: relative;
	width: 44px;
	height: 24px;
	background: ${(props) => (props.checked ? "#9147ff" : "#565656")};
	border-radius: 12px;
	transition: background-color 0.3s;
	margin-left: 12px;

	&::after {
		content: "";
		position: absolute;
		top: 3px;
		left: ${(props) => (props.checked ? "23px" : "3px")};
		width: 18px;
		height: 18px;
		background-color: #fff;
		border-radius: 50%;
		transition: left 0.3s;
	}
`;

const Input = styled.input`
	background: #0d0d0d;
	border: 1px solid #232323;
	color: white;
	font-size: 11px;
	border-radius: 7px;
	padding: 10px;
	width: 100%;
	margin-bottom: 10px;

	&:focus {
		outline: none;
		border-color: #9147ff;
	}
`;

const Select = styled.select`
	background: #0d0d0d;
	border: 1px solid #232323;
	color: white;
	font-size: 11px;
	border-radius: 7px;
	padding: 10px;
	width: 100%;
	margin-bottom: 10px;
	cursor: pointer;

	&:focus {
		outline: none;
		border-color: #9147ff;
	}
`;

const Button = styled.button<{ variant?: "primary" | "danger" }>`
	background: ${(props) => (props.variant === "danger" ? "#ff4757" : "#9147ff")};
	border: none;
	color: white;
	padding: 8px 16px;
	border-radius: 6px;
	font-size: 11px;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.2s ease;

	&:hover {
		opacity: 0.9;
	}

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
`;

const ChannelItem = styled.div`
	display: flex;
	gap: 10px;
	margin-bottom: 10px;
	align-items: center;
`;

const KeywordItem = styled.div`
	display: flex;
	gap: 10px;
	margin-bottom: 10px;
	align-items: center;
`;

const List = styled.div`
	margin-top: 16px;
`;

const AddButtonContainer = styled.div`
	margin-top: 12px;
`;

interface ChatMonitorSettingsComponentProps {
	workerService: WorkerService;
}

export function ChatMonitorSettingsComponent({ workerService }: ChatMonitorSettingsComponentProps) {
	const [data, setData] = useState<ChatMonitorStorageData | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const sharedStorageService = new SharedStorageService(workerService);

	// Form state for adding new items
	const [newChannelName, setNewChannelName] = useState("");
	const [newChannelPlatform, setNewChannelPlatform] = useState<"twitch" | "kick">("twitch");
	const [newKeyword, setNewKeyword] = useState("");

	useEffect(() => {
		loadData();
	}, []);

	const loadData = async () => {
		setLoading(true);
		try {
			const chatMonitorData = await sharedStorageService.getSharedStorageKey("chatMonitor");
			setData(chatMonitorData);
		} catch (error) {
			console.error("Failed to load chat monitor data:", error);
		} finally {
			setLoading(false);
		}
	};

	const saveData = async (newData: ChatMonitorStorageData) => {
		setSaving(true);
		try {
			await sharedStorageService.updateSharedStorageKey("chatMonitor", newData);
			setData(newData);
		} catch (error) {
			console.error("Failed to save chat monitor data:", error);
		} finally {
			setSaving(false);
		}
	};

	const toggleEnabled = () => {
		if (!data) return;
		saveData({ ...data, enabled: !data.enabled });
	};

	const addChannel = () => {
		if (!data || !newChannelName.trim()) return;
		if (data.channels.length >= 50) {
			alert("Maximum 50 channels allowed");
			return;
		}

		const newChannel = {
			platform: newChannelPlatform,
			channel: newChannelName.trim().toLowerCase(),
		};

		// Check for duplicates
		const exists = data.channels.some((ch) => ch.platform === newChannel.platform && ch.channel === newChannel.channel);

		if (exists) {
			alert("This channel is already in the list");
			return;
		}

		saveData({
			...data,
			channels: [...data.channels, newChannel],
		});

		setNewChannelName("");
	};

	const removeChannel = (index: number) => {
		if (!data) return;
		saveData({
			...data,
			channels: data.channels.filter((_, i) => i !== index),
		});
	};

	const addKeyword = () => {
		if (!data || !newKeyword.trim()) return;

		const keyword = newKeyword.trim().toLowerCase();

		// Check for duplicates
		if (data.keywords.includes(keyword)) {
			alert("This keyword is already in the list");
			return;
		}

		saveData({
			...data,
			keywords: [...data.keywords, keyword],
		});

		setNewKeyword("");
	};

	const removeKeyword = (index: number) => {
		if (!data) return;
		saveData({
			...data,
			keywords: data.keywords.filter((_, i) => i !== index),
		});
	};

	if (loading || !data) {
		return (
			<Container>
				<div style={{ textAlign: "center", padding: "40px", color: "#999" }}>Loading...</div>
			</Container>
		);
	}

	return (
		<Container>
			<Header>
				<Title>Chat Monitor</Title>
				<Description>
					Monitor chat messages from specified channels for keywords and receive real-time notifications. This is a
					shared feature that works across both Twitch and Kick.
				</Description>
			</Header>

			<Section>
				<ToggleContainer>
					<SectionTitle style={{ margin: 0 }}>Enable Chat Monitor</SectionTitle>
					<ToggleLabel>
						<ToggleSwitch checked={data.enabled} onClick={toggleEnabled} />
					</ToggleLabel>
				</ToggleContainer>

				<Description>
					When enabled, the chat monitor will connect to IRC for the channels you've added and watch for your keywords.
				</Description>
			</Section>

			<Section>
				<SectionTitle>Monitored Channels ({data.channels.length}/50)</SectionTitle>
				<Description style={{ marginBottom: "16px" }}>
					Add channels to monitor. You can monitor up to 50 channels across Twitch and Kick.
				</Description>

				<List>
					{data.channels.map((channel, index) => (
						<ChannelItem key={`${channel.platform}-${channel.channel}`}>
							<Input value={channel.channel} disabled style={{ flex: 1 }} />
							<Select value={channel.platform} disabled style={{ width: "120px" }}>
								<option value="twitch">Twitch</option>
								<option value="kick">Kick</option>
							</Select>
							<Button variant="danger" onClick={() => removeChannel(index)} disabled={saving}>
								Remove
							</Button>
						</ChannelItem>
					))}
				</List>

				{data.channels.length < 50 && (
					<AddButtonContainer>
						<ChannelItem>
							<Input
								value={newChannelName}
								onChange={(e) => setNewChannelName((e.target as HTMLInputElement).value)}
								placeholder="Enter channel name..."
								style={{ flex: 1 }}
								onKeyPress={(e) => e.key === "Enter" && addChannel()}
							/>
							<Select
								value={newChannelPlatform}
								onChange={(e) => setNewChannelPlatform((e.target as HTMLSelectElement).value as "twitch" | "kick")}
								style={{ width: "120px" }}
							>
								<option value="twitch">Twitch</option>
								<option value="kick">Kick</option>
							</Select>
							<Button onClick={addChannel} disabled={saving || !newChannelName.trim()}>
								Add
							</Button>
						</ChannelItem>
					</AddButtonContainer>
				)}
			</Section>

			<Section>
				<SectionTitle>Keywords ({data.keywords.length})</SectionTitle>
				<Description style={{ marginBottom: "16px" }}>
					Add keywords to monitor. When someone in a monitored channel sends a message containing any of these keywords,
					you'll receive a notification.
				</Description>

				<List>
					{data.keywords.map((keyword) => (
						<KeywordItem key={`keyword-${keyword}`}>
							<Input value={keyword} disabled style={{ flex: 1 }} />
							<Button variant="danger" onClick={() => removeKeyword(data.keywords.indexOf(keyword))} disabled={saving}>
								Remove
							</Button>
						</KeywordItem>
					))}
				</List>

				<AddButtonContainer>
					<KeywordItem>
						<Input
							value={newKeyword}
							onChange={(e) => setNewKeyword((e.target as HTMLInputElement).value)}
							placeholder="Enter keyword..."
							style={{ flex: 1 }}
							onKeyPress={(e) => e.key === "Enter" && addKeyword()}
						/>
						<Button onClick={addKeyword} disabled={saving || !newKeyword.trim()}>
							Add
						</Button>
					</KeywordItem>
				</AddButtonContainer>
			</Section>
		</Container>
	);
}
