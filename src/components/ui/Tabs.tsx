"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Radix Tabs handles roving focus and the arrow-key behaviour the ARIA
 * pattern requires; this wrapper supplies the styling.
 */

export interface TabDefinition {
  value: string;
  label: string;
  /** Rendered as a count beside the label. */
  badge?: ReactNode;
}

export function Tabs({
  tabs,
  value,
  onValueChange,
  children,
  className,
}: {
  tabs: TabDefinition[];
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <TabsPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      className={cn("flex flex-col", className)}
    >
      <TabsPrimitive.List className="flex items-center gap-1 border-b border-neutral-200">
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.value}
            value={tab.value}
            className={cn(
              "relative -mb-px inline-flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-base font-medium text-neutral-500",
              "transition-colors hover:text-neutral-800",
              "data-[state=active]:border-primary-700 data-[state=active]:text-primary-800",
            )}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span className="num rounded-sm bg-neutral-100 px-1.5 py-0.5 text-micro font-semibold text-neutral-600">
                {tab.badge}
              </span>
            )}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      {children}
    </TabsPrimitive.Root>
  );
}

export function TabPanel({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <TabsPrimitive.Content
      value={value}
      className={cn("pt-4 focus:outline-none", className)}
    >
      {children}
    </TabsPrimitive.Content>
  );
}
