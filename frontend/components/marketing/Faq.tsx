"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";

export type FaqItem = {
  question: string;
  answer: ReactNode;
};

/**
 * Accessible single-open accordion built on the Radix primitive. It keeps
 * keyboard semantics and focus handling intact without pulling shadcn's global
 * stylesheet into the dashboard.
 */
export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <Accordion.Root type="single" collapsible className="divide-y divide-[#e2ddd3]">
      {items.map((item, index) => (
        <Accordion.Item key={item.question} value={`item-${index}`}>
          <Accordion.Header>
            <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 py-4 text-left">
              <span className="text-[13.5px] font-medium text-ink transition group-hover:text-orange">
                {item.question}
              </span>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#dfdad0] bg-white text-[#6f6a62] transition duration-300 group-hover:border-[#c8c1b4] group-hover:text-ink group-data-[state=open]:rotate-45 group-data-[state=open]:bg-ink group-data-[state=open]:text-canvas">
                <Plus size={13} aria-hidden="true" />
              </span>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden data-[state=closed]:animate-[mk-accordion-up_180ms_ease-out] data-[state=open]:animate-[mk-accordion-down_220ms_ease-out]">
            <div className="max-w-[62ch] pb-4 pr-10 text-[12.5px] leading-relaxed text-[#5f5a53]">
              {item.answer}
            </div>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
