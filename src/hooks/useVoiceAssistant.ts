import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Lang } from "@/types";

export type SpeakingState = "idle" | "speaking" | "paused";

export interface VoiceAssistantReturn {
  isListening: boolean;
  speakingState: SpeakingState;
  startListening: (onResult: (transcript: string) => void) => void;
  stopListening: () => void;
  speak: (text: string, speakLang?: Lang) => void;
  pauseSpeech: () => void;
  resumeSpeech: () => void;
  stopSpeech: () => void;
}

export function useVoiceAssistant(lang: Lang): VoiceAssistantReturn {
  const [isListening, setIsListening] = useState(false);
  const [speakingState, setSpeakingState] = useState<SpeakingState>("idle");
  const recogRef = useRef<{ stop(): void } | null>(null);

  // Preload voices on mount
  useEffect(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () =>
        window.speechSynthesis.getVoices();
    }
    return () => {
      window.speechSynthesis?.cancel();
      recogRef.current?.stop();
    };
  }, []);

  const findVoice = (target: Lang): SpeechSynthesisVoice | null => {
    if (!("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (target === "hi") {
      return (
        voices.find((v) => v.lang === "hi-IN") ||
        voices.find((v) => v.lang?.toLowerCase().startsWith("hi")) ||
        null
      );
    }
    return voices.find((v) => v.lang?.toLowerCase().startsWith("en")) || null;
  };

  const speak = (text: string, speakLang: Lang = lang): void => {
    if (!("speechSynthesis" in window)) return;

    if (speakLang === "hi") {
      const hindiVoice = findVoice("hi");
      if (!hindiVoice) {
        toast.warning(
          "Hindi voice not available on your device. Showing text answer instead."
        );
        return;
      }
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.voice = hindiVoice;
      utter.lang = "hi-IN";
      utter.rate = 0.95;
      utter.onend = () => setSpeakingState("idle");
      utter.onerror = () => setSpeakingState("idle");
      window.speechSynthesis.speak(utter);
      setSpeakingState("speaking");
      return;
    }

    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const enVoice = findVoice("en");
    if (enVoice) utter.voice = enVoice;
    utter.lang = "en-US";
    utter.rate = 1;
    utter.onend = () => setSpeakingState("idle");
    utter.onerror = () => setSpeakingState("idle");
    window.speechSynthesis.speak(utter);
    setSpeakingState("speaking");
  };

  const pauseSpeech = (): void => {
    window.speechSynthesis.pause();
    setSpeakingState("paused");
  };

  const resumeSpeech = (): void => {
    window.speechSynthesis.resume();
    setSpeakingState("speaking");
  };

  const stopSpeech = (): void => {
    window.speechSynthesis.cancel();
    setSpeakingState("idle");
  };

  const startListening = (onResult: (transcript: string) => void): void => {
    // SpeechRecognition is not universally typed in lib.dom — define locally
    type SpeechRecognitionCtor = new () => {
      lang: string;
      interimResults: boolean;
      onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
      start(): void;
      stop(): void;
    };

    type WindowWithSR = Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };

    const SR =
      (window as WindowWithSR).SpeechRecognition ||
      (window as WindowWithSR).webkitSpeechRecognition;

    if (!SR) {
      toast.error("Voice input not supported in this browser");
      return;
    }
    const recog = new SR();
    recog.lang = lang === "hi" ? "hi-IN" : "en-US";
    recog.interimResults = false;
    recog.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setIsListening(false);
      onResult(transcript);
    };
    recog.onerror = () => setIsListening(false);
    recog.onend = () => setIsListening(false);
    recog.start();
    recogRef.current = recog;
    setIsListening(true);
  };

  const stopListening = (): void => {
    recogRef.current?.stop();
    setIsListening(false);
  };

  return {
    isListening,
    speakingState,
    startListening,
    stopListening,
    speak,
    pauseSpeech,
    resumeSpeech,
    stopSpeech,
  };
}
