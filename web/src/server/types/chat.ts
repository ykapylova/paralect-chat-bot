export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  id: string;
  chatId: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

export type Chat = {
  id: string;
  userId: string;
  title: string;
  updatedAt: string;
  createdAt: string;
};

export type ChatWithMessages = Chat & {
  messages: ChatMessage[];
};
