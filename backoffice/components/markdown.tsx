"use client";

import { Children, type ComponentProps, type ReactNode } from "react";
import ReactMarkdown, {
  type Components,
  type ExtraProps,
} from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "cn";

const remarkPlugins = [remarkGfm];

const block = "mt-3 first:mt-0";
const heading =
  "mt-5 font-heading font-semibold tracking-tight text-foreground first:mt-0";

/**
 * react-markdown passes the hast node on every element. It is not a DOM
 * attribute, so drop it before spreading props onto a tag.
 */
function omitNode<T extends ExtraProps>(props: T): Omit<T, "node"> {
  const { node, ...rest } = props;
  void node;
  return rest;
}

/**
 * Remark wraps blocks in newline text nodes. Those nodes are the first child,
 * so `first:` would miss the real first element. Drop only newline-only nodes
 * and keep the space that sits between a task checkbox and its label.
 */
function withoutNewlines(children: ReactNode): ReactNode {
  return Children.toArray(children).filter(
    (child) => typeof child !== "string" || !/^[\n\r]+$/.test(child),
  );
}

function hasClass(className: string | undefined, name: string): boolean {
  return className?.split(/\s+/).includes(name) ?? false;
}

type Tagged = ComponentProps<"h1"> & ExtraProps;

function makeHeading(
  tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6",
  size: string,
) {
  function Heading(props: Tagged) {
    const { className, ...rest } = omitNode(props);
    const Tag = tag;
    return <Tag className={cn(heading, size, className)} {...rest} />;
  }
  return Heading;
}

function Paragraph(props: ComponentProps<"p"> & ExtraProps) {
  const { className, ...rest } = omitNode(props);
  return <p className={cn(block, className)} {...rest} />;
}

function Strong(props: ComponentProps<"strong"> & ExtraProps) {
  const { className, ...rest } = omitNode(props);
  return <strong className={cn("font-semibold", className)} {...rest} />;
}

function Emphasis(props: ComponentProps<"em"> & ExtraProps) {
  const { className, ...rest } = omitNode(props);
  return <em className={cn("italic", className)} {...rest} />;
}

function Delete(props: ComponentProps<"del"> & ExtraProps) {
  const { className, ...rest } = omitNode(props);
  return <del className={cn("line-through", className)} {...rest} />;
}

function Link(props: ComponentProps<"a"> & ExtraProps) {
  const { className, ...rest } = omitNode(props);
  return (
    <a
      className={cn(
        "wrap-break-word text-primary underline underline-offset-2 break-words",
        className,
      )}
      {...rest}
      target="_blank"
      rel="noopener noreferrer"
    />
  );
}

function Image(props: ComponentProps<"img"> & ExtraProps) {
  const { className, alt, ...rest } = omitNode(props);
  return (
    // Markdown images are remote content, not app assets.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt ?? ""}
      className={cn("max-w-full rounded-lg", className)}
      {...rest}
    />
  );
}

function InlineCode(props: ComponentProps<"code"> & ExtraProps) {
  const { className, ...rest } = omitNode(props);
  return (
    <code
      className={cn(
        "rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]",
        className,
      )}
      {...rest}
    />
  );
}

function CodeBlock(props: ComponentProps<"pre"> & ExtraProps) {
  const { className, ...rest } = omitNode(props);
  return (
    <pre
      className={cn(
        block,
        "max-w-full overflow-x-auto rounded-xl bg-muted p-4 font-mono text-xs",
        "[&_code]:rounded-none [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-xs",
        className,
      )}
      {...rest}
    />
  );
}

function Quote(props: ComponentProps<"blockquote"> & ExtraProps) {
  const { className, children, ...rest } = omitNode(props);
  return (
    <blockquote
      className={cn(
        block,
        "border-l-2 border-border pl-4 text-muted-foreground",
        className,
      )}
      {...rest}
    >
      {withoutNewlines(children)}
    </blockquote>
  );
}

function Rule(props: ComponentProps<"hr"> & ExtraProps) {
  const { className, ...rest } = omitNode(props);
  return (
    <hr className={cn(block, "border-t border-border", className)} {...rest} />
  );
}

function listClassName(
  className: string | undefined,
  ordered: boolean,
): string {
  const task = hasClass(className, "contains-task-list");
  return cn(
    block,
    task ? "list-none pl-0" : ordered ? "list-decimal pl-5" : "list-disc pl-5",
    className,
  );
}

function BulletList(props: ComponentProps<"ul"> & ExtraProps) {
  const { className, children, ...rest } = omitNode(props);
  return (
    <ul className={listClassName(className, false)} {...rest}>
      {withoutNewlines(children)}
    </ul>
  );
}

function NumberedList(props: ComponentProps<"ol"> & ExtraProps) {
  const { className, children, ...rest } = omitNode(props);
  return (
    <ol className={listClassName(className, true)} {...rest}>
      {withoutNewlines(children)}
    </ol>
  );
}

function ListItem(props: ComponentProps<"li"> & ExtraProps) {
  const { className, children, ...rest } = omitNode(props);
  const task = hasClass(className, "task-list-item");
  return (
    <li
      className={cn(
        block,
        task ? "list-none" : "marker:text-muted-foreground",
        className,
      )}
      {...rest}
    >
      {withoutNewlines(children)}
    </li>
  );
}

function Checkbox(props: ComponentProps<"input"> & ExtraProps) {
  const { className, type, ...rest } = omitNode(props);
  if (type !== "checkbox") {
    return <input type={type} className={className} {...rest} />;
  }
  return (
    <input
      type="checkbox"
      className={cn("mr-2 align-middle accent-primary", className)}
      {...rest}
      disabled
    />
  );
}

function Table(props: ComponentProps<"table"> & ExtraProps) {
  const { className, children, ...rest } = omitNode(props);
  return (
    <div
      className={cn(
        block,
        "max-w-full overflow-x-auto rounded-lg border border-border",
      )}
    >
      <table
        className={cn("w-full border-collapse text-sm", className)}
        {...rest}
      >
        {children}
      </table>
    </div>
  );
}

function TableHeader(props: ComponentProps<"th"> & ExtraProps) {
  const { className, ...rest } = omitNode(props);
  return (
    <th
      className={cn(
        "border-b border-border bg-muted/60 px-3 py-2 text-left font-medium",
        className,
      )}
      {...rest}
    />
  );
}

function TableCell(props: ComponentProps<"td"> & ExtraProps) {
  const { className, ...rest } = omitNode(props);
  return (
    <td
      className={cn("border-b border-border px-3 py-2", className)}
      {...rest}
    />
  );
}

const components = {
  h1: makeHeading("h1", "text-xl"),
  h2: makeHeading("h2", "text-lg"),
  h3: makeHeading("h3", "text-base"),
  h4: makeHeading("h4", "text-sm"),
  h5: makeHeading("h5", "text-sm"),
  h6: makeHeading("h6", "text-sm"),
  p: Paragraph,
  ul: BulletList,
  ol: NumberedList,
  li: ListItem,
  strong: Strong,
  em: Emphasis,
  del: Delete,
  a: Link,
  img: Image,
  code: InlineCode,
  pre: CodeBlock,
  blockquote: Quote,
  hr: Rule,
  input: Checkbox,
  table: Table,
  th: TableHeader,
  td: TableCell,
} satisfies Components;

/** Renders a Markdown string with GitHub flavored Markdown and the panel theme. */
export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-full min-w-0 wrap-break-word text-sm leading-relaxed break-words text-foreground",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
