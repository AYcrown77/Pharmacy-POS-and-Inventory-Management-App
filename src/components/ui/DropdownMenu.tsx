"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface MenuAction {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
  /** Renders a divider above this item. */
  separated?: boolean;
}

/**
 * Row-action menu. Actions are passed as data rather than children so
 * permission filtering happens where the list is built, not in markup.
 */
export function RowActions({
  actions,
  label = "Row actions",
  align = "end",
}: {
  actions: MenuAction[];
  label?: string;
  align?: "start" | "center" | "end";
}) {
  if (actions.length === 0) return null;

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={label}
        className="inline-flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 data-[state=open]:bg-neutral-100"
        onClick={(event) => event.stopPropagation()}
      >
        <MoreHorizontal className="size-4" />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Content
          align={align}
          sideOffset={4}
          onClick={(event) => event.stopPropagation()}
          className="z-50 min-w-[11rem] rounded-md bg-white p-1 shadow-overlay"
        >
          {actions.map((action) => (
            <div key={action.id}>
              {action.separated && (
                <Menu.Separator className="my-1 h-px bg-neutral-200" />
              )}
              <Menu.Item
                disabled={action.disabled}
                onSelect={action.onSelect}
                className={cn(
                  "flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-base outline-none",
                  "data-[disabled]:pointer-events-none data-[disabled]:opacity-45",
                  action.tone === "danger"
                    ? "text-danger-700 data-[highlighted]:bg-danger-50"
                    : "text-neutral-700 data-[highlighted]:bg-neutral-100",
                )}
              >
                {action.icon}
                {action.label}
              </Menu.Item>
            </div>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
