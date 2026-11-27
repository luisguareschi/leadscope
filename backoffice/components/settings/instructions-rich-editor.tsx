"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import type { Editor } from "@tiptap/core";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  BoldIcon,
  CheckIcon,
  CodeIcon,
  ExternalLinkIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  QuoteIcon,
  Redo2Icon,
  StrikethroughIcon,
  Undo2Icon,
  UnlinkIcon,
  XIcon,
} from "lucide-react";
import { cn } from "cn";
import { InstructionsBubbleMenu } from "@/components/settings/instructions-bubble-menu";
import { createSlashCommandsExtension } from "@/components/settings/instructions-slash-menu";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  looksLikeMarkdown,
  normalizeLinkUrl,
} from "@/lib/instructions-editor-commands";

type LinkBarState =
  { open: false } | { open: true; url: string; error: string | null };

export function InstructionsRichEditor({
  value,
  onChange,
  ariaInvalid,
  headerLeading,
  isMac,
}: {
  value: string;
  onChange: (markdown: string) => void;
  ariaInvalid?: boolean;
  headerLeading: ReactNode;
  isMac: boolean;
}) {
  const lastSyncedRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const editorRef = useRef<Editor | null>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const [linkBar, setLinkBar] = useState<LinkBarState>({ open: false });

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        underline: false,
        link: {
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          defaultProtocol: "https",
          HTMLAttributes: {
            rel: "noopener noreferrer",
            target: "_blank",
          },
        },
      }),
      Markdown.configure({
        markedOptions: {
          gfm: true,
          breaks: true,
        },
      }),
      Placeholder.configure({
        showOnlyCurrent: true,
        placeholder: ({ editor, node }) => {
          if (editor.isEmpty) {
            return "Escribe las instrucciones del asistente o usa / para dar formato…";
          }
          if (node.type.name === "paragraph") {
            return "Escribe / para insertar bloques…";
          }
          return "";
        },
      }),
      createSlashCommandsExtension(),
    ],
    [],
  );

  const editor = useEditor({
    extensions,
    content: value,
    contentType: "markdown",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Instrucciones de la empresa",
        ...(ariaInvalid ? { "aria-invalid": "true" } : {}),
      },
      handlePaste: (_view, event) => {
        const current = editorRef.current;
        if (!current || current.isActive("codeBlock")) return false;
        const html = event.clipboardData?.getData("text/html");
        if (html) return false;
        const plain = event.clipboardData?.getData("text/plain");
        if (!plain || !looksLikeMarkdown(plain)) return false;
        event.preventDefault();
        current.commands.insertContent(plain, { contentType: "markdown" });
        return true;
      },
    },
    onUpdate: ({ editor: current }) => {
      const next = current.getMarkdown();
      lastSyncedRef.current = next;
      onChangeRef.current(next);
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    if (value === lastSyncedRef.current) return;
    lastSyncedRef.current = value;
    editor.commands.setContent(value, {
      contentType: "markdown",
      emitUpdate: false,
    });
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    if (ariaInvalid) dom.setAttribute("aria-invalid", "true");
    else dom.removeAttribute("aria-invalid");
  }, [editor, ariaInvalid]);

  useEffect(() => {
    if (linkBar.open) {
      requestAnimationFrame(() => {
        linkInputRef.current?.focus();
        linkInputRef.current?.select();
      });
    }
  }, [linkBar.open]);

  const toggleLinkBar = () => {
    if (!editor) return;
    if (linkBar.open) {
      setLinkBar({ open: false });
      editor.commands.focus();
      return;
    }
    const existingHref = String(editor.getAttributes("link").href ?? "");
    setLinkBar({ open: true, url: existingHref, error: null });
  };

  const applyToolbarLink = () => {
    if (!editor || !linkBar.open) return;
    if (!linkBar.url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinkBar({ open: false });
      return;
    }
    const normalized = normalizeLinkUrl(linkBar.url);
    if (!normalized) {
      setLinkBar({
        open: true,
        url: linkBar.url,
        error: "Introduce una URL válida (por ejemplo, https://empresa.com).",
      });
      return;
    }
    if (editor.state.selection.empty && !editor.isActive("link")) {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: normalized,
          marks: [{ type: "link", attrs: { href: normalized } }],
        })
        .run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: normalized })
        .run();
    }
    setLinkBar({ open: false });
  };

  const onLinkBarKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      applyToolbarLink();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setLinkBar({ open: false });
      editor?.commands.focus();
    }
  };

  const onCanvasMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (!editor) return;
    if (event.target === event.currentTarget) {
      event.preventDefault();
      editor.commands.focus("end");
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-3 py-2">
        {headerLeading}
        {editor ? (
          <RichToolbar
            editor={editor}
            isMac={isMac}
            linkOpen={linkBar.open}
            onToggleLink={toggleLinkBar}
          />
        ) : null}
      </div>

      {linkBar.open && editor ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-muted/40 px-4 py-2">
          <LinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            ref={linkInputRef}
            type="text"
            value={linkBar.url}
            placeholder="https://ejemplo.com"
            aria-label="URL del enlace"
            className="h-8 min-w-0 flex-1 rounded-lg bg-background px-2.5 text-sm text-foreground outline-none ring-1 ring-border focus:ring-2 focus:ring-ring/60 md:text-[13px]"
            onChange={(event) =>
              setLinkBar({ open: true, url: event.target.value, error: null })
            }
            onKeyDown={onLinkBarKeyDown}
          />
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={applyToolbarLink}
            >
              <CheckIcon className="size-3.5" />
              Aplicar
            </Button>
            {editor.isActive("link") ? (
              <>
                <a
                  href={String(editor.getAttributes("link").href ?? "")}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Abrir enlace"
                  className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <ExternalLinkIcon className="size-3.5" />
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="size-8"
                  aria-label="Quitar enlace"
                  onClick={() => {
                    editor
                      .chain()
                      .focus()
                      .extendMarkRange("link")
                      .unsetLink()
                      .run();
                    setLinkBar({ open: false });
                  }}
                >
                  <UnlinkIcon className="size-3.5" />
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="size-8"
              aria-label="Cerrar barra de enlace"
              onClick={() => {
                setLinkBar({ open: false });
                editor.commands.focus();
              }}
            >
              <XIcon className="size-3.5" />
            </Button>
          </div>
          {linkBar.error ? (
            <p className="w-full text-xs text-destructive">{linkBar.error}</p>
          ) : null}
        </div>
      ) : null}

      <div
        className="instructions-editor min-h-80 cursor-text px-5 py-4"
        onMouseDown={onCanvasMouseDown}
      >
        {editor ? (
          <>
            <InstructionsBubbleMenu editor={editor} isMac={isMac} />
            <EditorContent editor={editor} />
          </>
        ) : (
          <div className="min-h-72" aria-hidden="true" />
        )}
      </div>
    </>
  );
}

function RichToolbar({
  editor,
  isMac,
  linkOpen,
  onToggleLink,
}: {
  editor: Editor;
  isMac: boolean;
  linkOpen: boolean;
  onToggleLink: () => void;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      h1: current.isActive("heading", { level: 1 }),
      h2: current.isActive("heading", { level: 2 }),
      h3: current.isActive("heading", { level: 3 }),
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      strike: current.isActive("strike"),
      code: current.isActive("code"),
      bulletList: current.isActive("bulletList"),
      orderedList: current.isActive("orderedList"),
      blockquote: current.isActive("blockquote"),
      link: current.isActive("link"),
      canUndo: current.can().chain().focus().undo().run(),
      canRedo: current.can().chain().focus().redo().run(),
    }),
  });

  const mod = isMac ? "⌘" : "Ctrl+";

  return (
    <div className="ml-auto flex max-w-full flex-wrap items-center gap-0.5">
      <ToolbarButton
        label="Título 1"
        hint="#"
        active={state.h1}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1Icon />
      </ToolbarButton>
      <ToolbarButton
        label="Título 2"
        hint="##"
        active={state.h2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2Icon />
      </ToolbarButton>
      <ToolbarButton
        label="Título 3"
        hint="###"
        active={state.h3}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3Icon />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        label="Negrita"
        shortcut={`${mod}B`}
        active={state.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <BoldIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Cursiva"
        shortcut={`${mod}I`}
        active={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <ItalicIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Tachado"
        shortcut={`${mod}⇧X`}
        active={state.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <StrikethroughIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Código"
        shortcut={`${mod}E`}
        active={state.code}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <CodeIcon />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        label="Lista con viñetas"
        hint="-"
        active={state.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <ListIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Lista numerada"
        hint="1."
        active={state.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrderedIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Cita"
        hint=">"
        active={state.blockquote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <QuoteIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Separador"
        hint="---"
        active={false}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <MinusIcon />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        label={state.link ? "Editar enlace" : "Añadir enlace"}
        active={state.link || linkOpen}
        onClick={onToggleLink}
      >
        <LinkIcon />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        label="Deshacer"
        shortcut={`${mod}Z`}
        active={false}
        disabled={!state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2Icon />
      </ToolbarButton>
      <ToolbarButton
        label="Rehacer"
        shortcut={`${mod}⇧Z`}
        active={false}
        disabled={!state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2Icon />
      </ToolbarButton>
    </div>
  );
}

function ToolbarDivider() {
  return (
    <span
      className="mx-1 hidden h-4 w-px bg-border/80 sm:inline-block"
      aria-hidden="true"
    />
  );
}

function ToolbarButton({
  label,
  shortcut,
  hint,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  hint?: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={disabled}
            aria-label={shortcut ? `${label} (${shortcut})` : label}
            aria-pressed={active}
            className={cn(
              "max-md:size-9 md:max-lg:size-8",
              active && "bg-accent text-foreground hover:bg-accent",
            )}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut ? ` · ${shortcut}` : null}
        {hint ? (
          <>
            {" · "}
            <span className="font-mono">{hint}</span>
          </>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}
