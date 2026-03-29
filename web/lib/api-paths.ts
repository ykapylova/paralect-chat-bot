export const apiPaths = {
  chats: () => "/api/chats",
  chat: (chatId: string) => `/api/chats/${chatId}`,
  chatTurn: (chatId: string) => `/api/chats/${chatId}/turn`,
  meUsage: () => "/api/me/usage",
  uploadImage: () => "/api/uploads/image",
  uploadDocument: () => "/api/uploads/document",
} as const;
