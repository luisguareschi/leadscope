"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  BoldIcon,
  CheckIcon,
  CodeIcon,
  ExternalLinkIcon,
  ItalicIcon,
  LinkIcon,
  StrikethroughIcon,
  UnlinkIcon,
  XIcon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { normalizeLinkUrl } from "@/lib/instructions-editor-commands";

type BubbleView =
  { kind: "format" } | { kind: "link"; url: string; error: string | null };

export function InstructionsBubbleMenu({
  editor,
  isMac,
}: {
  editor: Editor;
  isMac: boolean;
}) {
  const [view, setView] = useState<BubbleView>({ kind: "format" });
  const linkInputRef = useRef<HTMLInputElement>(null);

  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      strike: current.isActive("strike"),
      code: current.isActive("code"),
      link: current.isActive("link"),
      linkHref: String(current.getAttributes("link").href ?? ""),
    }),
  });

  useEffect(() => {
    const resetView = () => {
      setView((current) =>
        current.kind === "format" ? current : { kind: "format" },
      );
    };
    editor.on("selectionUpdate", resetView);
    return () => {
      editor.off("selectionUpdate", resetView);
    };
  }, [editor]);

  useEffect(() => {
    if (view.kind === "link") {
      requestAnimationFrame(() => {
        linkInputRef.current?.focus();
        linkInputRef.current?.select();
      });
    }
  }, [view.kind]);

  const mod = isMac ? "⌘" : "Ctrl+";

  const openLinkView = () => {
    setView({
      kind: "link",
      url: active.linkHref,
      error: null,
    });
  };

  const applyLink = () => {
    if (view.kind !== "link") return;
    if (!view.url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setView({ kind: "format" });
      return;
    }
    const normalized = normalizeLinkUrl(view.url);
    if (!normalized) {
      setView({
        kind: "link",
        url: view.url,
        error: "URL no válida",
      });
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: normalized })
      .run();
    setView({ kind: "format" });
  };

  const removeLink = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setView({ kind: "format" });
  };

  const onLinkKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      applyLink();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setView({ kind: "format" });
      editor.commands.focus();
    }
  };

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: current, state }) => {
        if (!current.isEditable) return false;
        if (state.selection.empty) return false;
        if (state.selection instanceof NodeSelection) return false;
        if (current.isActive("codeBlock")) return false;
        return true;
      }}
      className="z-50"
    >
      <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-black/5 dark:ring-white/10">
        {view.kind === "format" ? (
          <div className="flex items-center gap-0.5">
            <BubbleButton
              label={`Negrita (${mod}B)`}
              active={active.bold}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <BoldIcon className="size-3.5" />
            </BubbleButton>
            <BubbleButton
              label={`Cursiva (${mod}I)`}
              active={active.italic}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <ItalicIcon className="size-3.5" />
            </BubbleButton>
            <BubbleButton
              label={`Tachado (${mod}⇧X)`}
              active={active.strike}
              onClick={() => editor.chain().focus().toggleStrike().run()}
            >
              <StrikethroughIcon className="size-3.5" />
            </BubbleButton>
            <BubbleButton
              label={`Código (${mod}E)`}
              active={active.code}
              onClick={() => editor.chain().focus().toggleCode().run()}
            >
              <CodeIcon className="size-3.5" />
            </BubbleButton>
            <span className="mx-0.5 h-4 w-px bg-border/80" aria-hidden="true" />
            <BubbleButton
              label={active.link ? "Editar enlace" : "Añadir enlace"}
              active={active.link}
              onClick={openLinkView}
            >
              <LinkIcon className="size-3.5" />
            </BubbleButton>
          </div>
        ) : (
          <div className="flex flex-col gap-1 px-1 py-0.5">
            <div className="flex items-center gap-1">
              <input
                ref={linkInputRef}
                type="text"
                value={view.url}
                placeholder="https://ejemplo.com"
                aria-label="URL del enlace"
                className="h-7 w-52 rounded-md bg-muted/70 px-2 text-xs text-foreground outline-none ring-1 ring-transparent focus:ring-ring/60"
                onChange={(event) =>
                  setView({
                    kind: "link",
                    url: event.target.value,
                    error: null,
                  })
                }
                onKeyDown={onLinkKeyDown}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Aplicar enlace"
                onClick={applyLink}
              >
                <CheckIcon className="size-3.5" />
              </Button>
              {active.linkHref ? (
                <>
                  <a
                    href={active.linkHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Abrir enlace"
                    className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <ExternalLinkIcon className="size-3.5" />
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Quitar enlace"
                    onClick={removeLink}
                  >
                    <UnlinkIcon className="size-3.5" />
                  </Button>
                </>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Cancelar"
                onClick={() => {
                  setView({ kind: "format" });
                  editor.commands.focus();
                }}
              >
                <XIcon className="size-3.5" />
              </Button>
            </div>
            {view.error ? (
              <p className="px-1 text-[11px] text-destructive">{view.error}</p>
            ) : null}
          </div>
        )}
      </div>
    </BubbleMenu>
  );
}

function BubbleButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "size-7 rounded-lg",
        active && "bg-accent text-foreground hover:bg-accent",
      )}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
