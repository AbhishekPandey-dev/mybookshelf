import { useRef, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Mic, MicOff, Sparkles, X } from "lucide-react";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { useAI } from "@/hooks/useAI";
import type { Lang, ChatMessage } from "@/types";

interface Props {
  resourceId: string;
  currentPage: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onJumpToPage?: (page: number) => void;
}

/** Animated typing dots — shown while AI is thinking */
function TypingDots() {
  return (
    <div className="flex justify-start">
      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"
            style={{ animationDelay: `${i * 120}ms`, animationDuration: "800ms" }}
          />
        ))}
      </div>
    </div>
  );
}

/** Source page pill — clickable, jumps to page */
function PagePill({
  page,
  onJump,
}: {
  page: number;
  onJump?: (p: number) => void;
}) {
  return (
    <button
      onClick={() => onJump?.(page)}
      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
    >
      📄 Page {page}
    </button>
  );
}

/** Extract page numbers from an AI answer (looks for "Page X" patterns) */
function extractPages(text: string): number[] {
  const matches = [...text.matchAll(/\bpage\s+(\d+)/gi)];
  const pages = matches.map((m) => parseInt(m[1], 10)).filter((n) => !isNaN(n));
  return [...new Set(pages)];
}

export default function AIAssistant({
  resourceId,
  currentPage,
  open,
  onOpenChange,
  onJumpToPage,
}: Props) {
  const [lang, setLang] = useState<Lang>("en");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { isLoading, askQuestion } = useAI(resourceId);
  const {
    isListening,
    startListening,
    stopListening,
  } = useVoiceAssistant(lang);

  const scrollToBottom = () =>
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

  const handleAsk = async (q?: string): Promise<void> => {
    const question = (q ?? input).trim();
    if (!question || isLoading) return;
    const askLang = lang;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: question, lang: askLang }]);
    scrollToBottom();
    const answer = await askQuestion(question, askLang);
    if (answer) {
      setMessages((m) => [...m, { role: "assistant", content: answer, lang: askLang }]);
      scrollToBottom();
    }
  };

  const isOpen = open !== undefined ? open : false;
  const handleOpenChange = (v: boolean) => onOpenChange?.(v);

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange}>
      <DrawerContent
        className="
          /* mobile: bottom sheet up to 90vh */
          max-h-[90vh] flex flex-col
          /* desktop: right-side panel */
          sm:fixed sm:inset-y-0 sm:right-0 sm:left-auto sm:top-0
          sm:h-full sm:w-[420px] sm:max-h-full
          sm:rounded-none sm:rounded-l-2xl
          bg-gray-50
        "
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <DrawerHeader className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <DrawerTitle className="font-semibold text-base text-gray-900">
              AI Assistant
            </DrawerTitle>
          </div>

          {/* Language toggle */}
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 p-0.5 bg-gray-100 rounded-full">
              <button
                onClick={() => setLang("en")}
                className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
                  lang === "en"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLang("hi")}
                className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all font-hindi ${
                  lang === "hi"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                हिं
              </button>
            </div>

            <button
              onClick={() => handleOpenChange(false)}
              className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </DrawerHeader>

        {/* ── Chat history ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <p className="text-sm font-medium text-gray-700">
                {lang === "hi" ? (
                  <span className="font-hindi">इस PDF के बारे में कुछ भी पूछें</span>
                ) : (
                  "Ask anything about this document"
                )}
              </p>
              <p className="text-xs text-gray-400">
                Currently on page {currentPage}
              </p>
            </div>
          )}

          {messages.map((m, i) =>
            m.role === "user" ? (
              /* User bubble — right aligned, indigo */
              <div key={i} className="flex justify-end">
                <div
                  className={`max-w-[80%] bg-indigo-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed ${
                    m.lang === "hi" ? "font-hindi" : ""
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ) : (
              /* AI bubble — left aligned, white */
              <div key={i} className="flex flex-col gap-2">
                <div
                  className={`max-w-[88%] bg-white border border-gray-100 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap ${
                    m.lang === "hi" ? "font-hindi" : ""
                  }`}
                >
                  {m.content}
                </div>
                {/* Source page pills */}
                {extractPages(m.content).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pl-1">
                    {extractPages(m.content).map((pg) => (
                      <PagePill key={pg} page={pg} onJump={onJumpToPage} />
                    ))}
                  </div>
                )}
              </div>
            )
          )}

          {/* Typing indicator */}
          {isLoading && <TypingDots />}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input row ───────────────────────────────────────────── */}
        <div className="flex-shrink-0 bg-white border-t border-gray-100 px-3 py-3">
          <form
            onSubmit={(e) => { e.preventDefault(); handleAsk(); }}
            className="flex items-center gap-2"
          >
            {/* Text input */}
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                lang === "hi" ? "इस दस्तावेज़ के बारे में पूछें…" : "Ask anything about this document..."
              }
              className={`flex-1 h-11 rounded-full border-gray-200 bg-gray-50 text-sm placeholder:text-gray-400 focus-visible:ring-indigo-400 ${
                lang === "hi" ? "font-hindi" : ""
              }`}
              disabled={isLoading}
            />

            {/* Mic button */}
            <button
              type="button"
              onClick={() =>
                isListening
                  ? stopListening()
                  : startListening(handleAsk)
              }
              className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                isListening
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              aria-label={isListening ? "Stop listening" : "Start voice input"}
            >
              {isListening ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>

            {/* Send button */}
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim()}
              className="w-11 h-11 rounded-full bg-indigo-600 hover:bg-indigo-700 flex-shrink-0"
              aria-label="Send"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
