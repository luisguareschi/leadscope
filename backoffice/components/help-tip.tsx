"use client";

import type { ReactNode } from "react";
import { Popover } from "@base-ui/react/popover";
import { CircleHelpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

/** A "?" next to a label: tapping it (or hovering it with a mouse) shows the explanation. */
export function HelpTip({
  label,
  children,
  className,
}: {
  /** What the button is for, for screen readers. */
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        openOnHover
        delay={0}
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            // A 40px touch target around the 24px icon on phones.
            className="relative text-muted-foreground after:absolute after:-inset-2 md:after:hidden"
            aria-label={label}
            onClick={(event) => event.stopPropagation()}
          />
        }
      >
        <CircleHelpIcon />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="isolate z-50"
        >
          <Popover.Popup
            className={cn(
              "max-w-72 origin-(--transform-origin) rounded-xl bg-popover p-3 text-xs leading-relaxed text-popover-foreground shadow-xl ring-1 ring-border/70 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              className,
            )}
          >
            <Popover.Arrow className="data-[side=bottom]:-top-2 data-[side=left]:-right-3.25 data-[side=left]:rotate-90 data-[side=right]:-left-3.25 data-[side=right]:-rotate-90 data-[side=top]:-bottom-2 data-[side=top]:rotate-180">
              <ArrowSvg />
            </Popover.Arrow>
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ArrowSvg() {
  return (
    <svg width="20" height="10" viewBox="0 0 20 10" fill="none" aria-hidden>
      <path
        d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z"
        className="fill-popover"
      />
      <path
        d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
        className="fill-border"
      />
    </svg>
  );
}
