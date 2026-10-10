export enum ChatAttachmentMessageType {
	FIRST = 0,
	LAST = 1,
}

export type ChatAttachmentData = {
	url: URL;
	messageType: ChatAttachmentMessageType;
	messageElement: Element;
	attachmentType: string;
	attachmentSize: number;
};

export type BaseChatAttachmentData = Omit<ChatAttachmentData, "attachmentType" | "attachmentSize">;

export type AttachmentHeadData = {
	type: string | null;
	size: string | null;
};

export type AttachmentUrlParser = {
	[host: string]: (url: URL) => URL;
};
