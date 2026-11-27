"use client";

import {
  forwardRef,
  useImperativeHandle,
  useState,
  type ComponentType,
} from "react";
import { Extension, type Editor, type Range } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, {
  exitSuggestion,
  type SuggestionKeyDownProps,
  type SuggestionProps,
} from "@tiptap/suggestion";
import {
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  PilcrowIcon,
  QuoteIcon,
  SquareCodeIcon,
} from "lucide-react";
import { cn } from "cn";
import {
  filterSlashCommands,
  SLASH_COMMANDS,
  type SlashCommandId,
  type SlashCommandItem,
} from "@/lib/instructions-editor-commands";

const SLASH_PLUGIN_KEY = new PluginKey("instructionsSlashCommands");

const SLASH_ICONS: Record<
  SlashCommandId,
  ComponentType<{ className?: string }>
> = {
  paragraph: PilcrowIcon,
  heading1: Heading1Icon,
  heading2: Heading2Icon,
  heading3: Heading3Icon,
  bulletList: ListIcon,
  orderedList: ListOrderedIcon,
  blockquote: QuoteIcon,
  horizontalRule: MinusIcon,
  codeBlock: SquareCodeIcon,
};

const SLASH_COMMAND_ACTIONS: Record<SlashCommandId, (editor: Editor) => void> =
  {
    paragraph: (editor) => {
      editor.chain().focus().setParagraph().run();
    },
    heading1: (editor) => {
      editor.chain().focus().setHeading({ level: 1 }).run();
    },
    heading2: (editor) => {
      editor.chain().focus().setHeading({ level: 2 }).run();
    },
    heading3: (editor) => {
      editor.chain().focus().setHeading({ level: 3 }).run();
    },
    bulletList: (editor) => {
      editor.chain().focus().toggleBulletList().run();
    },
    orderedList: (editor) => {
      editor.chain().focus().toggleOrderedList().run();
    },
    blockquote: (editor) => {
      editor.chain().focus().toggleBlockquote().run();
    },
    horizontalRule: (editor) => {
      editor.chain().focus().setHorizontalRule().run();
    },
    codeBlock: (editor) => {
      editor.chain().focus().toggleCodeBlock().run();
    },
  };

type SlashMenuHandle = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
};

type SlashMenuListProps = {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
};

const SlashMenuList = forwardRef<SlashMenuHandle, SlashMenuListProps>(
  function SlashMenuList({ items, command }, ref) {
    const [prevItems, setPrevItems] = useState(items);
    const [selectedIndex, setSelectedIndex] = useState(0);

    if (items !== prevItems) {
      setPrevItems(items);
      setSelectedIndex(0);
    }

    const activeIndex = items.length > 0 ? selectedIndex % items.length : 0;

    useImperativeHandle(
      ref,
      () => ({
        onKeyDown: ({ event, view }) => {
          if (event.key === "Escape") {
            event.preventDefault();
            exitSuggestion(view, SLASH_PLUGIN_KEY);
            return true;
          }
          if (items.length === 0) return false;
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setSelectedIndex((current) =>
              current <= 0 ? items.length - 1 : current - 1,
            );
            return true;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setSelectedIndex((current) => (current + 1) % items.length);
            return true;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            const chosen = items[activeIndex];
            if (chosen) command(chosen);
            return true;
          }
          return false;
        },
      }),
      [activeIndex, command, items],
    );

    return (
      <div
        role="listbox"
        aria-label="Insertar bloque"
        className="z-50 max-h-72 w-72 overflow-y-auto rounded-xl border border-border/80 bg-popover p-1.5 text-popover-foreground shadow-lg ring-1 ring-black/5 dark:ring-white/10"
        onMouseDown={(event) => event.preventDefault()}
      >
        {items.length === 0 ? (
          <p className="px-2.5 py-2 text-xs text-muted-foreground">
            Sin resultados
          </p>
        ) : (
          items.map((item, index) => {
            const Icon = SLASH_ICONS[item.id];
            const selected = index === activeIndex;
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => command(item)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors",
                  selected
                    ? "bg-accent text-accent-foreground"
                    : "text-popover-foreground hover:bg-accent/60",
                )}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground">
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium leading-tight">
                    {item.label}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {item.description}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground/80">
                  {item.shortcut}
                </span>
              </button>
            );
          })
        )}
      </div>
    );
  },
);

export function createSlashCommandsExtension() {
  return Extension.create({
    name: "instructionsSlashCommands",

    addProseMirrorPlugins() {
      return [
        Suggestion<SlashCommandItem, SlashCommandItem>({
          pluginKey: SLASH_PLUGIN_KEY,
          editor: this.editor,
          char: "/",
          startOfLine: false,
          allowedPrefixes: [" "],
          initialItems: [...SLASH_COMMANDS],
          dismissOnOutsideClick: true,
          allow: ({ state }) => !state.selection.$from.parent.type.spec.code,
          items: ({ query }) => [...filterSlashCommands(query)],
          command: ({
            editor,
            range,
            props,
          }: {
            editor: Editor;
            range: Range;
            props: SlashCommandItem;
          }) => {
            editor.chain().focus().deleteRange(range).run();
            SLASH_COMMAND_ACTIONS[props.id](editor);
          },
          render: () => {
            let component: ReactRenderer<
              SlashMenuHandle,
              SlashMenuListProps
            > | null = null;
            let unmount: (() => void) | null = null;

            return {
              onStart: (props: SuggestionProps<SlashCommandItem>) => {
                component = new ReactRenderer(SlashMenuList, {
                  props: {
                    items: props.items,
                    command: props.command,
                  },
                  editor: props.editor,
                });
                unmount = props.mount(component.element);
              },
              onUpdate: (props: SuggestionProps<SlashCommandItem>) => {
                component?.updateProps({
                  items: props.items,
                  command: props.command,
                });
              },
              onKeyDown: (props: SuggestionKeyDownProps) => {
                if (props.event.key === "Escape") {
                  exitSuggestion(props.view, SLASH_PLUGIN_KEY);
                  return true;
                }
                return component?.ref?.onKeyDown(props) ?? false;
              },
              onExit: () => {
                unmount?.();
                unmount = null;
                component?.destroy();
                component = null;
              },
            };
          },
        }),
      ];
    },
  });
}
