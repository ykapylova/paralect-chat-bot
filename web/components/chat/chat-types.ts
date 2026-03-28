export type UiRole = "user" | "assistant";

export type UiMessage = {
  id: string;
  role: UiRole;
  text: string;
  createdAt: string;
  isPending?: boolean;
};
