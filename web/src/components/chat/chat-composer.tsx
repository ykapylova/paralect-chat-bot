import type { ChangeEvent, FormEvent, KeyboardEvent, RefObject } from "react";
import { ImageIcon, MessageCircle, Paperclip, SendHorizontal, X } from "lucide-react";

type ChatComposerProps = {
  formRef: RefObject<HTMLFormElement | null>;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  imageInputRef: RefObject<HTMLInputElement | null>;
  draft: string;
  onDraftChange: (value: string) => void;
  selectedFile: File | null;
  selectedImage: File | null;
  onRemoveFile: () => void;
  onRemoveImage: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onComposerFocus: () => void;
  onComposerKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onPickFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onPickImage: (event: ChangeEvent<HTMLInputElement>) => void;
  onOpenAttachmentPicker: (kind: "file" | "image") => void;
  sendDisabled: boolean;
  composerBusy: boolean;
  attachmentDisabled: boolean;
  anonFreeLimitReached: boolean;
};

export function ChatComposer({
  formRef,
  textareaRef,
  fileInputRef,
  imageInputRef,
  draft,
  onDraftChange,
  selectedFile,
  selectedImage,
  onRemoveFile,
  onRemoveImage,
  onSubmit,
  onComposerFocus,
  onComposerKeyDown,
  onPickFile,
  onPickImage,
  onOpenAttachmentPicker,
  sendDisabled,
  composerBusy,
  attachmentDisabled,
  anonFreeLimitReached,
}: ChatComposerProps) {
  return (
    <footer className="sticky bottom-0 mt-auto bg-gradient-to-t from-[var(--background)] via-[var(--background)] to-transparent px-4 pb-5 pt-6">
      <form className="mx-auto w-full max-w-3xl" onSubmit={onSubmit} ref={formRef}>
        <div className="rounded-[28px] border border-[var(--border)] bg-[var(--panel)] p-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition focus-within:border-[#c9d0dd] focus-within:shadow-[0_10px_34px_rgba(0,0,0,0.1)]">
          {(selectedFile || selectedImage) && (
            <div className="flex flex-wrap gap-2 px-2 pb-2 pt-1">
              {selectedFile && (
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1 text-xs text-[var(--foreground)]">
                  <span className="max-w-[260px] truncate">File: {selectedFile.name}</span>
                  <button
                    aria-label="Remove file"
                    className="rounded-full p-0.5 text-[var(--muted)] transition hover:bg-white hover:text-[var(--foreground)]"
                    onClick={onRemoveFile}
                    type="button"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {selectedImage && (
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1 text-xs text-[var(--foreground)]">
                  <span className="max-w-[260px] truncate">Image: {selectedImage.name}</span>
                  <button
                    aria-label="Remove image"
                    className="rounded-full p-0.5 text-[var(--muted)] transition hover:bg-white hover:text-[var(--foreground)]"
                    onClick={onRemoveImage}
                    type="button"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          )}
          <div className="grid grid-cols-[1fr_auto] gap-x-2.5 px-0.5">
            <textarea
              className="min-h-[44px] w-full resize-none bg-transparent px-3 py-2 text-[15px] leading-6 outline-none placeholder:text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={composerBusy || anonFreeLimitReached}
              onChange={(event) => onDraftChange(event.target.value)}
              onFocus={onComposerFocus}
              onKeyDown={onComposerKeyDown}
              placeholder={anonFreeLimitReached ? "Sign in to send more messages" : "Ask anything"}
              ref={textareaRef}
              rows={1}
              value={draft}
            />
            <button
              className="row-span-2 mt-1 inline-flex h-10 w-10 items-center justify-center self-center rounded-full bg-black text-white transition hover:scale-[1.02] hover:opacity-90 disabled:cursor-not-allowed disabled:scale-100 disabled:bg-[#d1d5db]"
              disabled={sendDisabled}
              type="submit"
            >
              <SendHorizontal className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1 px-1 pb-1">
              <button
                className="rounded-full p-2 text-[var(--muted)] transition hover:bg-[var(--panel-soft)] hover:text-[var(--foreground)] disabled:opacity-40"
                disabled={attachmentDisabled}
                onClick={() => void onOpenAttachmentPicker("file")}
                type="button"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <button
                className="rounded-full p-2 text-[var(--muted)] transition hover:bg-[var(--panel-soft)] hover:text-[var(--foreground)] disabled:opacity-40"
                disabled={attachmentDisabled}
                onClick={() => void onOpenAttachmentPicker("image")}
                type="button"
              >
                <ImageIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
          <input className="hidden" onChange={onPickFile} ref={fileInputRef} type="file" />
          <input accept="image/*" className="hidden" onChange={onPickImage} ref={imageInputRef} type="file" />
          <div className="flex items-center gap-2 px-2 pb-1 pt-1 text-[11px] text-[var(--muted)]">
            <MessageCircle className="h-3.5 w-3.5" />
            <span>Messages are generated by AI and may be inaccurate.</span>
          </div>
        </div>
      </form>
    </footer>
  );
}
