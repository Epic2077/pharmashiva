export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
}

export interface Chat {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
  streaming: boolean;
}
