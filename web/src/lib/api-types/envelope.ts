/** Shared JSON shapes for App Router API handlers and `api-client`. */

export type ApiOk<T> = { data: T };

export type ApiErr = { error: string; code?: string };

export type ApiAck = { success: true };
