import type { EnhancerAccountComponentProps } from "$types/shared/components/enhancer-account.component.types.ts";
import type { EnhancerAccountState } from "$types/shared/worker/enhancer-account-worker.types.ts";
import { useEffect, useState } from "preact/hooks";
import styled from "styled-components";

const Container = styled.div`
	line-height: 1.6;
	color: var(--settings-text);
	width: 100%;
	background: var(--settings-surface);
	border: 1px solid var(--settings-border);
	border-radius: 12px;
	padding: 16px 18px;
	display: flex;
	flex-direction: column;
	gap: 10px;
`;

const Row = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
`;

const Name = styled.span`
	color: var(--settings-text-strong);
	font-size: 13px;
	font-weight: 600;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

const Hint = styled.span`
	color: var(--settings-text-muted);
	font-size: 11.5px;
`;

const ErrorText = styled.span`
	color: #ff4757;
	font-size: 11.5px;
`;

const AccountButton = styled.button`
	background: #9147ff;
	border: 1px solid #9147ff;
	border-radius: 8px;
	color: white;
	padding: 7px 14px;
	font-size: 11px;
	font-weight: 600;
	cursor: pointer;
	flex-shrink: 0;

	&:hover:not(:disabled) {
		background: #a35fff;
	}

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
`;

const LogoutButton = styled.button`
	background: var(--settings-control-background);
	border: 1px solid var(--settings-control-border);
	border-radius: 8px;
	color: var(--settings-text);
	padding: 7px 14px;
	font-size: 11px;
	font-weight: 500;
	cursor: pointer;
	flex-shrink: 0;

	&:hover:not(:disabled) {
		border-color: #9147ff;
		color: #9147ff;
	}

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
`;

export function EnhancerAccountComponent({ workerService }: EnhancerAccountComponentProps) {
	const [account, setAccount] = useState<EnhancerAccountState>({ loggedIn: false });
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let active = true;
		void workerService.send("getEnhancerAccount").then((state) => {
			if (active && state) setAccount(state);
		});
		const handleUpdate = (payload: { account: EnhancerAccountState; error?: string }) => {
			if (!active) return;
			setAccount(payload.account);
			if (payload.error) setError(payload.error);
		};
		workerService.onBroadcast("enhancer-account-updated", handleUpdate);
		return () => {
			active = false;
			workerService.offBroadcast("enhancer-account-updated", handleUpdate);
		};
	}, [workerService]);

	const login = async () => {
		setBusy(true);
		setError(null);
		try {
			const response = await workerService.send("loginEnhancerAccount");
			if (!response) {
				setError("Login request timed out.");
				return;
			}
			if (response.success) setAccount(response.account);
			else if (response.reason === "failed") setError(response.message);
		} finally {
			setBusy(false);
		}
	};

	const logout = async () => {
		setBusy(true);
		setError(null);
		try {
			await workerService.send("logoutEnhancerAccount");
			setAccount({ loggedIn: false });
		} finally {
			setBusy(false);
		}
	};

	const displayName = account.displayName ?? account.username ?? "Enhancer account";

	return (
		<Container>
			<Row>
				<Name>{account.loggedIn ? displayName : "Not logged in"}</Name>
				{account.loggedIn ? (
					<LogoutButton type="button" onClick={logout} disabled={busy}>
						{busy ? "…" : "Log out"}
					</LogoutButton>
				) : (
					<AccountButton type="button" onClick={login} disabled={busy}>
						{busy ? "…" : "Log in"}
					</AccountButton>
				)}
			</Row>
			<Hint>
				Log in with your Enhancer account to claim Moments with one click. Optional — without it you can still redeem
				via !redeem in chat.
			</Hint>
			{error && <ErrorText>{error}</ErrorText>}
		</Container>
	);
}
