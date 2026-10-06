"use client";

import { useEffect, useRef, useState } from "react";
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

// The browser's built-in speech recognition (Chrome, Edge, Safari; not
// Firefox). Typed minimally here because TypeScript's DOM lib doesn't ship it.
type SpeechResultList = ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

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
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  // Speak a question: words fill the box as you talk, and it sends when you stop.
  function toggleMic() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Recognition = getSpeechRecognition();
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    let finalText = "";
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      setInput((finalText + interim).trim());
    };
    recognition.onerror = (event) => {
      setMicError(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Microphone access is blocked. Allow it in your browser's site settings, then try again."
          : event.error === "no-speech"
            ? "Didn't hear anything. Tap the mic and try again."
            : "The microphone didn't work. Type your question instead.",
      );
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      const text = finalText.trim();
      if (text) {
        sendMessage({ text });
        setInput("");
      }
    };
    recognitionRef.current = recognition;
    setMicError(null);
    setInput("");
    setListening(true);
    recognition.start();
  }

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
          {micError && (
            <p className="px-3 pt-2 text-xs text-red-600 dark:text-red-400">{micError}</p>
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
              placeholder={listening ? "Listening…" : "Ask a question..."}
              className="min-w-0 flex-1 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-2 py-1 text-sm text-neutral-900 dark:text-neutral-100"
            />
            {getSpeechRecognition() && (
              <button
                type="button"
                onClick={toggleMic}
                disabled={status === "streaming"}
                aria-label={listening ? "Stop listening" : "Speak your question"}
                aria-pressed={listening}
                title={listening ? "Stop listening" : "Speak your question"}
                className={`rounded px-2 py-1 text-white disabled:opacity-50 ${
                  listening ? "animate-pulse bg-red-600" : "bg-neutral-500 hover:bg-neutral-600 dark:bg-neutral-600"
                }`}
              >
                <MicIcon />
              </button>
            )}
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
