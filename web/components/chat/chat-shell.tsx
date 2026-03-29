"use client";

import { useAuth } from "@clerk/nextjs";
import type { ChangeEvent, ClipboardEvent, FormEvent, KeyboardEvent } from "react";
import {
  type SetStateAction,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type { ChatWithMessages } from "server/types/chat";
import { ApiError, uploadChatImage, uploadChatUserPickedFile } from "lib/api-client";
import { DEFAULT_CHAT_TITLE } from "lib/chat-defaults";
import type { ChatUploadResult } from "lib/api-types/upload";
import { CHAT_AUTO_TITLE_MAX_LENGTH, CHAT_COMPOSER_TEXTAREA_MAX_HEIGHT_PX } from "lib/chat-ui-constants";
import { queryKeys } from "lib/query-keys";

import { ChatComposer } from "./chat-composer";
import { imageFileFromComposerPaste } from "./chat-shell-utils";
import { ChatHeader } from "./chat-header";
import { ChatMessageThread } from "./chat-message-thread";
import { ChatSidebar } from "./chat-sidebar";
import { ChatUsageBanner } from "./chat-usage-banner";
import { useChatMutations } from "./use-chat-mutations";
import { useChatQueries } from "./use-chat-queries";

export function ChatShell() {
  const { isLoaded, userId } = useAuth();
  const isGuestMode = isLoaded && !userId;

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [sidebarRenamingChatId, setSidebarRenamingChatId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [attachmentUploadPending, setAttachmentUploadPending] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const updateSelectedChatId = useCallback((value: SetStateAction<string | null>) => {
    setSidebarRenamingChatId(null);
    setSelectedChatId(value);
  }, []);

  const closeMobileSidebar = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      setShowSidebar(false);
    }
  }, []);

  const handleSidebarSelectChat = useCallback(
    (id: string) => {
      updateSelectedChatId(id);
      closeMobileSidebar();
    },
    [updateSelectedChatId, closeMobileSidebar],
  );

  const {
    queryClient,
    chatsQuery,
    chatDetailQuery,
    activeChatId,
    chatsForSidebar,
    activeMessages,
    activeTitle,
    usage,
    anonFreeLimitReached,
    isBootLoading,
    isChatLoading,
    queryLoadError,
  } = useChatQueries({
    isLoaded,
    userId,
    isGuestMode,
    selectedChatId,
  });

  const { createChatMutation, patchChatMutation, deleteChatMutation, sendMutation } = useChatMutations({
    queryClient,
    updateSelectedChatId,
    closeMobileSidebar,
    setDraft,
    setAttachmentError,
  });

  useLayoutEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      if (mq.matches) setShowSidebar(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const handleComposerFocus = () => {
    if (anonFreeLimitReached) return;
    if (isGuestMode && (chatsQuery.data?.length ?? 0) > 0) return;
    if (selectedChatId !== null || createChatMutation.isPending) return;
    createChatMutation.mutate();
  };

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sendMutation.isPending || createChatMutation.isPending || attachmentUploadPending) return;
    if (anonFreeLimitReached) return;

    const text = draft.trim();
    const hasAttachments = Boolean(selectedFile || selectedImage);
    if (!text && !hasAttachments) return;

    setAttachmentError(null);

    let chatId = selectedChatId;
    if (!chatId) {
      if (isGuestMode) {
        const list = chatsQuery.data ?? [];
        if (list.length > 0) {
          chatId = list[0].id;
          updateSelectedChatId(chatId);
        } else {
          try {
            const chat = await createChatMutation.mutateAsync();
            chatId = chat.id;
          } catch {
            return;
          }
        }
      } else {
        try {
          const chat = await createChatMutation.mutateAsync();
          chatId = chat.id;
        } catch {
          return;
        }
      }
    }

    const uploaded: ChatUploadResult[] = [];
    if (hasAttachments) {
      setAttachmentUploadPending(true);
      try {
        if (selectedImage) {
          uploaded.push(await uploadChatImage(selectedImage));
        }
        if (selectedFile) {
          uploaded.push(await uploadChatUserPickedFile(selectedFile));
        }
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Upload failed";
        setAttachmentError(msg);
        setAttachmentUploadPending(false);
        return;
      }
      setAttachmentUploadPending(false);
    }

    const attachmentLines = uploaded.map((u) =>
      u.type === "image"
        ? `![${u.filename}](${u.signedUrl})`
        : `[${u.filename}](${u.signedUrl})`,
    );
    const content =
      text.length > 0
        ? attachmentLines.length > 0
          ? `${text}\n\n${attachmentLines.join("\n")}`
          : text
        : attachmentLines.join("\n");

    const detail =
      queryClient.getQueryData<ChatWithMessages>(queryKeys.chat.detail(chatId)) ?? chatDetailQuery.data;
    const wasEmpty = (detail?.messages.length ?? 0) === 0;
    const currentTitle = detail?.title ?? "";
    const shouldRename = wasEmpty && (currentTitle === DEFAULT_CHAT_TITLE || currentTitle.length === 0);
    const nextTitle = content.slice(0, CHAT_AUTO_TITLE_MAX_LENGTH);

    setDraft("");
    setSelectedFile(null);
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (imageInputRef.current) imageInputRef.current.value = "";

    sendMutation.mutate({
      chatId,
      content,
      shouldRename,
      nextTitle,
      optimisticId: `optimistic-${crypto.randomUUID()}`,
    });
  };

  const ensureChatReadyForAttachment = async (): Promise<boolean> => {
    if (sendMutation.isPending || attachmentUploadPending || anonFreeLimitReached) {
      return false;
    }
    if (selectedChatId !== null) {
      return true;
    }
    if (isGuestMode) {
      const list = chatsQuery.data ?? [];
      if (list.length > 0) {
        updateSelectedChatId(list[0].id);
        return true;
      }
      if (createChatMutation.isPending) {
        return false;
      }
      try {
        await createChatMutation.mutateAsync();
        return true;
      } catch {
        return false;
      }
    }
    if (createChatMutation.isPending) {
      return false;
    }
    try {
      await createChatMutation.mutateAsync();
      return true;
    } catch {
      return false;
    }
  };

  const openAttachmentPicker = async (kind: "file" | "image") => {
    setAttachmentError(null);
    const ok = await ensureChatReadyForAttachment();
    if (!ok) return;
    if (kind === "file") {
      fileInputRef.current?.click();
    } else {
      imageInputRef.current?.click();
    }
  };

  const handleFilePick = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] ?? null);
  };

  const handleImagePick = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedImage(event.target.files?.[0] ?? null);
  };

  const sendDisabled =
    sendMutation.isPending ||
    createChatMutation.isPending ||
    attachmentUploadPending ||
    anonFreeLimitReached ||
    (!draft.trim() && !selectedFile && !selectedImage);

  const attachmentDisabled =
    sendMutation.isPending ||
    attachmentUploadPending ||
    (selectedChatId === null && createChatMutation.isPending) ||
    anonFreeLimitReached;
  const textareaDisabled = sendMutation.isPending || attachmentUploadPending || anonFreeLimitReached;

  const handleComposerPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (attachmentDisabled || textareaDisabled) return;
    const file = imageFileFromComposerPaste(event);
    if (!file) return;
    event.preventDefault();
    setAttachmentError(null);
    void (async () => {
      const ok = await ensureChatReadyForAttachment();
      if (!ok) return;
      setSelectedImage(file);
    })();
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    const max = CHAT_COMPOSER_TEXTAREA_MAX_HEIGHT_PX;
    const nextHeight = Math.min(textarea.scrollHeight, max);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > max ? "auto" : "hidden";
  }, [draft]);

  const loadError = queryLoadError ?? sendMutation.error?.message;
  const bannerError = loadError ?? attachmentError;

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (sendDisabled) return;
    formRef.current?.requestSubmit();
  };

  const removeFile = () => {
    setSelectedFile(null);
    setAttachmentError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = () => {
    setSelectedImage(null);
    setAttachmentError(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  useEffect(() => {
    if (isGuestMode || !showSidebar) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setShowSidebar(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSidebar, isGuestMode]);

  useEffect(() => {
    if (isGuestMode || !showSidebar) return;
    const mq = window.matchMedia("(max-width: 767px)");
    if (!mq.matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showSidebar, isGuestMode]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      {!isGuestMode ? (
        <ChatSidebar
          activeChatId={activeChatId}
          chats={chatsForSidebar}
          createPending={createChatMutation.isPending}
          deletePending={deleteChatMutation.isPending}
          isBootLoading={isBootLoading}
          onDeleteChat={(chatId) => {
            if (!window.confirm("Delete this chat? This cannot be undone.")) return;
            deleteChatMutation.mutate(chatId);
          }}
          onNewChat={() => createChatMutation.mutate()}
          onPatchChat={(input) => patchChatMutation.mutate(input)}
          onRenamingChatIdChange={setSidebarRenamingChatId}
          onSelectChat={handleSidebarSelectChat}
          open={showSidebar}
          patchPending={patchChatMutation.isPending}
          renamingChatId={sidebarRenamingChatId}
        />
      ) : null}

      <main className="flex min-w-0 flex-1 flex-col">
        <ChatHeader
          activeChatId={activeChatId}
          activeTitle={activeTitle}
          isGuestMode={isGuestMode}
          menuOpen={showSidebar}
          onToggleSidebar={() => setShowSidebar((prev) => !prev)}
          showMenu={!isGuestMode}
        />

        <ChatUsageBanner usage={usage} />

        {bannerError ? (
          <div className="mx-auto max-w-3xl px-4 py-3 text-center text-sm text-red-600">{bannerError}</div>
        ) : null}

        <ChatMessageThread
          activeChatId={activeChatId}
          anonFreeLimitReached={anonFreeLimitReached}
          isBootLoading={isBootLoading}
          isChatLoading={isChatLoading}
          isGuestMode={isGuestMode}
          messages={activeMessages}
        />

        <ChatComposer
          anonFreeLimitReached={anonFreeLimitReached}
          attachmentDisabled={attachmentDisabled}
          textareaDisabled={textareaDisabled}
          draft={draft}
          fileInputRef={fileInputRef}
          formRef={formRef}
          imageInputRef={imageInputRef}
          onComposerFocus={handleComposerFocus}
          onComposerKeyDown={handleComposerKeyDown}
          onComposerPaste={handleComposerPaste}
          onDraftChange={setDraft}
          onOpenAttachmentPicker={openAttachmentPicker}
          onPickFile={handleFilePick}
          onPickImage={handleImagePick}
          onRemoveFile={removeFile}
          onRemoveImage={removeImage}
          onSubmit={handleSend}
          selectedFile={selectedFile}
          selectedImage={selectedImage}
          sendDisabled={sendDisabled}
          textareaRef={textareaRef}
        />
      </main>

      {!isGuestMode && showSidebar ? (
        <button
          aria-label="Close menu"
          className="fixed bottom-0 left-0 right-0 top-14 z-[40] bg-black/40 backdrop-blur-[2px] md:hidden"
          onClick={() => setShowSidebar(false)}
          type="button"
        />
      ) : null}
    </div>
  );
}
