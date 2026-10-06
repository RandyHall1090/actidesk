"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { StaceyRobot } from "./StaceyRobot";

// Each word split into [highlighted initial, rest]; the initials spell STACEY.
const NAME_WORDS: [string, string][] = [
  ["S", "ecurafy's"],
  ["T", "otal"],
  ["A", "utomation"],
  ["C", "ontrol"],
  ["E", "ngine"],
  ["", "for"],
  ["Y", "ou"],
];

const REP_INTRO =
  "Ask how to build a prospect package, send it, or check whether your prospect opened it. Stacey answers from ActiDesk's help guide.";

export function HelpChatWidget({
  api = "/api/help-chat",
  intro = REP_INTRO,
}: {
  api?: string;
  intro?: string;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api }),
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Ask Stacey"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 dark:bg-blue-700 text-white shadow-lg transition-transform hover:scale-105 hover:bg-blue-700"
      >
        <StaceyRobot size={28} />
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[28rem] w-80 flex-col overflow-hidden rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 shadow-xl">
          <div className="flex items-start gap-3 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 dark:bg-blue-700 text-white">
              <StaceyRobot size={22} />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-[0.3em] text-neutral-900 dark:text-neutral-100">STACEY</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {NAME_WORDS.map(([initial, rest], index) => (
                  <span key={index}>
                    {index > 0 && " "}
                    {initial && (
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100">{initial}</span>
                    )}
                    {rest}
                  </span>
                ))}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-neutral-500 dark:text-neutral-400">
                {intro}
              </p>
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={message.role === "user" ? "text-right" : "text-left"}
              >
                <p
                  className={
                    message.role === "user"
                      ? "inline-block rounded-lg bg-blue-600 dark:bg-blue-700 px-3 py-2 text-sm text-white"
                      : "inline-block rounded-lg bg-neutral-100 dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
                  }
                >
                  {message.parts
                    .map((part) => (part.type === "text" ? part.text : ""))
                    .join("")}
                </p>
              </div>
            ))}
          </div>
          {error && (
            <p className="px-3 pt-2 text-xs text-red-600 dark:text-red-400">
              {error.message.startsWith("Too many questions")
                ? error.message
                : "Something went wrong — try again."}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!input.trim()) return;
              sendMessage({ text: input });
              setInput("");
            }}
            className="flex gap-2 border-t border-neutral-200 dark:border-neutral-700 p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              className="flex-1 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-2 py-1 text-sm text-neutral-900 dark:text-neutral-100"
            />
            <button
              type="submit"
              disabled={status === "streaming"}
              className="rounded bg-blue-600 dark:bg-blue-700 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
