"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentType,
} from "react";
import {
  Extension,
  type ChainedCommands,
  type Editor,
  type Range,
} from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, {
  exitSuggestion,
  type SuggestionKeyDownProps,
  type SuggestionPlacement,
  type SuggestionProps,
} from "@tiptap/suggestion";
import { MotionConfig, motion } from "motion/react";
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
const EXIT_DURATION_MS = 130;

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

const SLASH_COMMAND_ACTIONS: Record<
  SlashCommandId,
  (chain: ChainedCommands) => ChainedCommands
> = {
  paragraph: (chain) => chain.setParagraph(),
  heading1: (chain) => chain.setHeading({ level: 1 }),
  heading2: (chain) => chain.setHeading({ level: 2 }),
  heading3: (chain) => chain.setHeading({ level: 3 }),
  bulletList: (chain) => chain.toggleBulletList(),
  orderedList: (chain) => chain.toggleOrderedList(),
  blockquote: (chain) => chain.toggleBlockquote(),
  horizontalRule: (chain) => chain.setHorizontalRule(),
  codeBlock: (chain) => chain.toggleCodeBlock(),
};

type SlashMenuHandle = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
};

type SlashMenuListProps = {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
  open: boolean;
  placement: SuggestionPlacement;
};

const SlashMenuList = forwardRef<SlashMenuHandle, SlashMenuListProps>(
  function SlashMenuList({ items, command, open, placement }, ref) {
    const [prevItems, setPrevItems] = useState(items);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const scrollOnSelectRef = useRef(false);

    if (items !== prevItems) {
      setPrevItems(items);
      setSelectedIndex(0);
    }

    const activeIndex = items.length > 0 ? selectedIndex % items.length : 0;

    useEffect(() => {
      itemRefs.current.length = items.length;
      listRef.current?.scrollTo({ top: 0 });
    }, [items]);

    useEffect(() => {
      if (!scrollOnSelectRef.current) return;
      scrollOnSelectRef.current = false;
      itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
    }, [activeIndex, items]);

    useImperativeHandle(
      ref,
      () => ({
        onKeyDown: ({ event }) => {
          if (items.length === 0) return false;
          if (event.key === "ArrowUp") {
            event.preventDefault();
            scrollOnSelectRef.current = true;
            setSelectedIndex((current) =>
              current <= 0 ? items.length - 1 : current - 1,
            );
            return true;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            scrollOnSelectRef.current = true;
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

    const opensAbove = placement.startsWith("top");
    const slideOffset = opensAbove ? 4 : -4;

    return (
      <MotionConfig reducedMotion="user">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: slideOffset }}
          animate={
            open
              ? { opacity: 1, scale: 1, y: 0 }
              : { opacity: 0, scale: 0.96, y: slideOffset }
          }
          transition={{
            duration: open ? 0.14 : 0.11,
            ease: [0.22, 1, 0.36, 1],
          }}
          className={cn(
            "z-50 w-72 overflow-hidden rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-xl shadow-black/10 ring-1 ring-black/5 dark:shadow-black/40 dark:ring-white/10",
            opensAbove ? "origin-bottom-left" : "origin-top-left",
            !open && "pointer-events-none",
          )}
          onMouseDown={(event) => event.preventDefault()}
        >
          <div
            ref={listRef}
            role="listbox"
            aria-label="Insertar bloque"
            className="no-scrollbar scrollbar-none max-h-[min(19rem,calc(100dvh-6rem))] overflow-y-auto overscroll-contain scroll-py-1.5 p-1.5"
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
                    ref={(node) => {
                      itemRefs.current[index] = node;
                    }}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => {
                      scrollOnSelectRef.current = false;
                      setSelectedIndex(index);
                    }}
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
        </motion.div>
      </MotionConfig>
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
          placement: "bottom-start",
          offset: { mainAxis: 6, crossAxis: 0 },
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
            SLASH_COMMAND_ACTIONS[props.id](
              editor.chain().focus().deleteRange(range),
            ).run();
          },
          render: () => {
            let component: ReactRenderer<
              SlashMenuHandle,
              SlashMenuListProps
            > | null = null;
            let unmount: (() => void) | null = null;
            let exitTimer: ReturnType<typeof setTimeout> | null = null;
            let exiting = false;
            let lastProps: Omit<SlashMenuListProps, "open"> | null = null;

            const teardown = () => {
              if (exitTimer !== null) {
                clearTimeout(exitTimer);
                exitTimer = null;
              }
              exiting = false;
              unmount?.();
              unmount = null;
              component?.destroy();
              component = null;
              lastProps = null;
            };

            return {
              onStart: (props: SuggestionProps<SlashCommandItem>) => {
                teardown();
                lastProps = {
                  items: props.items,
                  command: props.command,
                  placement: props.placement,
                };
                component = new ReactRenderer(SlashMenuList, {
                  props: {
                    ...lastProps,
                    open: true,
                  },
                  editor: props.editor,
                });
                const element = component.element;
                unmount = props.mount(element, {
                  onPosition: ({ x, y, placement, strategy }) => {
                    if (exiting || !component || !lastProps) return;
                    element.style.position = strategy;
                    element.style.left = `${x}px`;
                    element.style.top = `${y}px`;
                    element.style.zIndex = "50";
                    if (lastProps.placement !== placement) {
                      lastProps = { ...lastProps, placement };
                      component.updateProps({ ...lastProps, open: true });
                    }
                  },
                });
              },
              onUpdate: (props: SuggestionProps<SlashCommandItem>) => {
                if (!component || exiting) return;
                lastProps = {
                  items: props.items,
                  command: props.command,
                  placement: lastProps?.placement ?? props.placement,
                };
                component.updateProps({
                  ...lastProps,
                  open: true,
                });
              },
              onKeyDown: (props: SuggestionKeyDownProps) => {
                if (props.event.key === "Escape") {
                  props.event.preventDefault();
                  exitSuggestion(props.view, SLASH_PLUGIN_KEY);
                  return true;
                }
                return component?.ref?.onKeyDown(props) ?? false;
              },
              onExit: (props: SuggestionProps<SlashCommandItem>) => {
                if (!component || !lastProps || props.editor.isDestroyed) {
                  teardown();
                  return;
                }
                const reducedMotion =
                  typeof window !== "undefined" &&
                  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                if (reducedMotion) {
                  teardown();
                  return;
                }
                exiting = true;
                if (exitTimer !== null) {
                  clearTimeout(exitTimer);
                }
                component.updateProps({
                  ...lastProps,
                  open: false,
                });
                exitTimer = setTimeout(teardown, EXIT_DURATION_MS);
              },
            };
          },
        }),
      ];
    },
  });
}
