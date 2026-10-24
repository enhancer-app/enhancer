import { AdditionalFontsHelper } from "$shared/module/helpers/additional-fonts.helper.ts";
import { nicknameFeedback } from "$shared/utils/nickname.utils.ts";
import type { ChatStyleCardProps, ChatStyleNotice } from "$types/shared/components/enhancer-account.component.types.ts";
import { useEffect, useState } from "preact/hooks";
import styled from "styled-components";

const SUBSCRIPTIONS_URL = "https://dashboard.enhancer.at/account/support";
const FONT_LINK_CLASS = "enhancer-chat-style-font";
const PLATFORM_NAMES = { TWITCH: "Twitch", KICK: "Kick" } as const;

const Card = styled.div`
	background: var(--settings-surface);
	border: 1px solid var(--settings-border);
	border-radius: 12px;
	overflow: hidden;
`;

const Header = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
	padding: 14px 16px;
`;

const Title = styled.div`
	font-size: 14px;
	font-weight: 600;
	color: var(--settings-text-strong);
`;

const Description = styled.div`
	margin-top: 3px;
	font-size: 12.5px;
	line-height: 1.45;
	color: var(--settings-text-muted);
`;

const Body = styled.div`
	display: grid;
	gap: 18px;
	padding: 0 16px 16px;
`;

const Preview = styled.div`
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	gap: 0 4px;
	padding: 14px 16px;
	border-radius: 10px;
	background: var(--settings-well);
	box-shadow: inset 0 0 0 1px var(--settings-border);
	font-size: 14px;
`;

const PreviewName = styled.span<{ $glow: boolean }>`
	font-weight: 700;
	color: #a970ff;
	text-shadow: ${({ $glow }) => ($glow ? "#a970ff 0 0 10px" : "none")};
`;

const PreviewMessage = styled.span`
	color: var(--settings-text);
`;

const FieldRow = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
`;

const Block = styled.div`
	display: grid;
	gap: 8px;
`;

const Label = styled.div`
	font-size: 13px;
	font-weight: 600;
	color: var(--settings-text-strong);
`;

const Hint = styled.div<{ $error?: boolean }>`
	font-size: 12.5px;
	line-height: 1.45;
	color: ${({ $error }) => ($error ? "var(--settings-danger, #ff5c6c)" : "var(--settings-text-muted)")};
`;

const Switch = styled.button<{ $on: boolean }>`
	position: relative;
	flex-shrink: 0;
	width: 36px;
	height: 21px;
	padding: 0;
	border: none;
	border-radius: 999px;
	background: ${({ $on }) => ($on ? "var(--settings-accent, #9147ff)" : "var(--settings-toggle-background)")};
	cursor: pointer;

	&::after {
		content: "";
		position: absolute;
		top: 2.5px;
		left: 2.5px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #ffffff;
		transform: translateX(${({ $on }) => ($on ? "15px" : "0")});
		transition: transform 0.2s ease;
	}

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
`;

const Fonts = styled.div`
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
`;

const FontButton = styled.button<{ $active: boolean }>`
	padding: 7px 11px;
	border: none;
	border-radius: 8px;
	background: ${({ $active }) => ($active ? "var(--settings-accent-soft, rgba(145, 71, 255, 0.14))" : "transparent")};
	box-shadow: inset 0 0 0 1px
		${({ $active }) => ($active ? "var(--settings-accent, #9147ff)" : "var(--settings-control-border)")};
	color: var(--settings-text-primary);
	font-size: 14px;
	cursor: pointer;

	&:hover:not(:disabled) {
		box-shadow: inset 0 0 0 1px var(--settings-accent-hover, #a970ff);
	}

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
`;

const NicknameRow = styled.div`
	display: flex;
	gap: 8px;
`;

const NicknameInput = styled.input<{ $invalid: boolean }>`
	flex: 1;
	min-width: 0;
	height: 34px;
	padding: 0 11px;
	border: none;
	border-radius: 8px;
	outline: none;
	background: var(--settings-control-background);
	box-shadow: inset 0 0 0 1px
		${({ $invalid }) => ($invalid ? "var(--settings-danger, #ff5c6c)" : "var(--settings-border)")};
	color: var(--settings-text-primary);
	font: inherit;
	font-size: 13px;

	&:focus {
		box-shadow: inset 0 0 0 1px
			${({ $invalid }) => ($invalid ? "var(--settings-danger, #ff5c6c)" : "var(--settings-accent, #9147ff)")};
	}

	&:disabled {
		opacity: 0.6;
	}
`;

const Status = styled.span<{ $tone: "success" | "warning" | "danger" }>`
	display: inline-flex;
	align-items: center;
	gap: 6px;
	font-size: 12px;
	color: ${({ $tone }) => ($tone === "success" ? "#7bed9f" : $tone === "warning" ? "#ffc861" : "#ff7a85")};

	&::before {
		content: "";
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: currentColor;
	}
`;

const Footer = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;
`;

const Notice = styled.div<{ $tone: ChatStyleNotice["tone"] }>`
	flex: 1;
	font-size: 12.5px;
	color: ${({ $tone }) => ($tone === "success" ? "#7bed9f" : "var(--settings-danger, #ff5c6c)")};
`;

const Button = styled.button<{ $primary?: boolean }>`
	height: 34px;
	padding: 0 14px;
	border: none;
	border-radius: 8px;
	background: ${({ $primary }) => ($primary ? "var(--settings-accent, #9147ff)" : "transparent")};
	color: ${({ $primary }) => ($primary ? "#ffffff" : "var(--settings-text-muted)")};
	font: inherit;
	font-size: 13px;
	font-weight: 500;
	white-space: nowrap;
	cursor: pointer;

	&:hover:not(:disabled) {
		background: ${({ $primary }) =>
			$primary ? "var(--settings-accent-hover, #a970ff)" : "var(--settings-surface-hover)"};
		color: ${({ $primary }) => ($primary ? "#ffffff" : "var(--settings-text-primary)")};
	}

	&:disabled {
		opacity: 0.5;
		cursor: default;
	}
`;

const LinkButton = styled.a`
	display: inline-flex;
	align-items: center;
	height: 34px;
	padding: 0 14px;
	border-radius: 8px;
	background: var(--settings-surface-raised);
	color: var(--settings-text-primary);
	font-size: 13px;
	font-weight: 500;
	text-decoration: none;
	white-space: nowrap;

	&:hover {
		background: var(--settings-surface-hover);
	}
`;

function plural(count: number, word: string): string {
	return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function timeOf(value: string): string {
	return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dateOf(value: string): string {
	return new Date(value).toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" });
}

function fontFamily(font: string): string {
	return `'${font}', inherit`;
}

function useChatStyleFonts(fonts: string[], enabled: boolean) {
	useEffect(() => {
		if (!enabled) return;
		for (const font of fonts) {
			const href = AdditionalFontsHelper.fontUrl(font);
			if (document.head.querySelector(`link.${FONT_LINK_CLASS}[href="${href}"]`)) continue;
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = href;
			link.classList.add(FONT_LINK_CLASS);
			document.head.append(link);
		}
	}, [enabled, fonts.join("|")]);
}

export function ChatStyleCard(props: ChatStyleCardProps) {
	const { perks, account, plansAvailable } = props;
	const anyPerk = perks.glowAllowed || perks.fontAllowed || perks.nicknameAllowed;
	if (!anyPerk && account.nickname === null) {
		if (!plansAvailable) return null;
		return (
			<Card>
				<Header>
					<div>
						<Title>Chat style</Title>
						<Description>
							A glowing name, your own font and a custom nickname in every chat come with a subscription.
						</Description>
					</div>
					<LinkButton href={SUBSCRIPTIONS_URL} target="_blank" rel="noopener noreferrer">
						See subscriptions
					</LinkButton>
				</Header>
			</Card>
		);
	}
	return <ChatStyleEditor key={account.accountId} {...props} />;
}

function ChatStyleEditor({ perks, account, onSaveStyle, onSubmitNickname, onClearNickname }: ChatStyleCardProps) {
	const [glow, setGlow] = useState(account.hasGlow);
	const [font, setFont] = useState(account.customFont ?? "");
	const [nickname, setNickname] = useState(account.nickname ?? "");
	const [busy, setBusy] = useState(false);
	const [notice, setNotice] = useState<ChatStyleNotice | null>(null);
	useChatStyleFonts(perks.fonts, perks.fontAllowed);

	useEffect(() => {
		setGlow(account.hasGlow);
		setFont(account.customFont ?? "");
	}, [account.hasGlow, account.customFont, account.styleCooldownUntil]);

	useEffect(() => {
		setNickname(account.nickname ?? "");
	}, [account.nickname, account.nicknamePending]);

	const [now] = useState(() => Date.now());
	const platform = PLATFORM_NAMES[account.platform];
	const showNickname = perks.nicknameAllowed || account.nickname !== null;
	const styleLocked = account.styleCooldownUntil !== null && new Date(account.styleCooldownUntil).getTime() > now;
	const nicknameLocked =
		account.nicknameCooldownUntil !== null && new Date(account.nicknameCooldownUntil).getTime() > now;

	const styleChanged =
		(perks.glowAllowed && glow !== account.hasGlow) || (perks.fontAllowed && font !== (account.customFont ?? ""));
	const nicknameChanged =
		perks.nicknameAllowed && nickname.trim() !== "" && nickname.trim() !== (account.nickname ?? "");
	const feedback = nicknameFeedback(nickname);
	const nicknameError = nicknameChanged ? feedback.error : undefined;
	const previewName = (perks.nicknameAllowed && (nickname.trim() || account.nickname)) || account.displayName;
	const previewFont = perks.fontAllowed && font ? font : null;

	const reset = () => {
		setGlow(account.hasGlow);
		setFont(account.customFont ?? "");
		setNickname(account.nickname ?? "");
		setNotice(null);
	};

	const save = async () => {
		setBusy(true);
		setNotice(null);
		if (styleChanged) {
			const error = await onSaveStyle({
				accountId: account.accountId,
				hasGlow: perks.glowAllowed && glow,
				customFont: perks.fontAllowed && font ? font : null,
			});
			if (error) {
				setNotice({ tone: "error", text: error });
				setBusy(false);
				return;
			}
		}
		if (nicknameChanged) {
			const error = await onSubmitNickname(account.accountId, nickname.trim());
			if (error) {
				setNotice({ tone: "error", text: error });
				setBusy(false);
				return;
			}
		}
		setNotice({ tone: "success", text: nicknameChanged ? "Saved. Your nickname is in review." : "Saved." });
		setBusy(false);
	};

	const removeNickname = async () => {
		setBusy(true);
		setNotice(null);
		const error = await onClearNickname(account.accountId);
		setNotice(error ? { tone: "error", text: error } : { tone: "success", text: "Nickname removed." });
		setBusy(false);
	};

	const nicknameStatus = account.nicknamePending ? (
		<Status $tone="warning">In review: {account.nicknamePending}</Status>
	) : account.nicknameRejected ? (
		<Status $tone="danger">
			Not approved
			{account.nicknameRejected.reason ? `: ${account.nicknameRejected.reason}` : ""}
		</Status>
	) : account.nickname ? (
		<Status $tone="success">Approved</Status>
	) : null;

	return (
		<Card>
			<Header>
				<div>
					<Title>Chat style</Title>
					<Description>
						How @{account.login} looks in {platform} chats with the extension. It switches off while your plan is
						paused.
					</Description>
				</div>
			</Header>
			<Body>
				<Preview aria-label="Preview">
					<PreviewName
						$glow={glow && perks.glowAllowed}
						style={previewFont ? { fontFamily: fontFamily(previewFont) } : undefined}
					>
						{previewName}
					</PreviewName>
					<PreviewMessage>: hey chat, how is everyone doing? 👋</PreviewMessage>
				</Preview>

				{perks.glowAllowed && (
					<FieldRow>
						<div>
							<Label>Glow</Label>
							<Hint>Your name glows in {platform} chats.</Hint>
						</div>
						<Switch
							type="button"
							role="switch"
							aria-checked={glow}
							aria-label="Glowing name"
							$on={glow}
							disabled={styleLocked || busy}
							onClick={() => setGlow(!glow)}
						/>
					</FieldRow>
				)}

				{perks.fontAllowed && (
					<Block>
						<Label>Font</Label>
						<Fonts>
							{["", ...perks.fonts].map((name) => (
								<FontButton
									key={name || "default"}
									type="button"
									aria-pressed={font === name}
									$active={font === name}
									disabled={styleLocked || busy}
									style={name ? { fontFamily: fontFamily(name) } : undefined}
									onClick={() => setFont(name)}
								>
									{name || "Default"}
								</FontButton>
							))}
						</Fonts>
					</Block>
				)}
				{styleLocked && account.styleCooldownUntil && (
					<Hint>You can change this style again after {timeOf(account.styleCooldownUntil)}.</Hint>
				)}

				{showNickname && (
					<Block>
						<Label>Nickname</Label>
						<NicknameRow>
							<NicknameInput
								type="text"
								aria-label="Nickname"
								aria-invalid={Boolean(nicknameError)}
								$invalid={Boolean(nicknameError)}
								placeholder={account.displayName}
								value={nickname}
								disabled={!perks.nicknameAllowed || nicknameLocked || account.nicknamePending !== null || busy}
								onInput={(event) => setNickname(event.currentTarget.value)}
							/>
							{account.nickname && (
								<Button type="button" disabled={busy} onClick={() => void removeNickname()}>
									Remove
								</Button>
							)}
						</NicknameRow>
						<Hint $error={Boolean(nicknameError)}>{nicknameError ?? feedback.hint}</Hint>
						{nicknameStatus}
						<Hint>
							{!perks.nicknameAllowed
								? "Hidden until your plan includes a nickname again."
								: nicknameLocked && account.nicknameCooldownUntil
									? `You can change it again on ${dateOf(account.nicknameCooldownUntil)}.`
									: `Shown instead of your name on ${platform}. Reviewed before it goes live${
											perks.nicknameCooldownDays > 0
												? `; changeable every ${plural(perks.nicknameCooldownDays, "day")}`
												: ""
										}.`}
						</Hint>
					</Block>
				)}

				<Footer>
					{notice ? <Notice $tone={notice.tone}>{notice.text}</Notice> : <Notice $tone="success" />}
					<Button
						type="button"
						disabled={busy || (!styleChanged && nickname === (account.nickname ?? ""))}
						onClick={reset}
					>
						Reset
					</Button>
					<Button
						type="button"
						$primary
						disabled={busy || (!styleChanged && !nicknameChanged) || Boolean(nicknameError)}
						onClick={() => void save()}
					>
						{busy ? "Saving…" : "Save changes"}
					</Button>
				</Footer>
			</Body>
		</Card>
	);
}
