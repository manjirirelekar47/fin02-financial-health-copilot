// src/components/VoiceCommand.jsx — Interactive Mic button with MediaRecorder audio capture and soundwave animation
import React, { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "../context/SettingsContext";

export default function VoiceCommand({ className = "", onCommandExecuted = null }) {
  const { currentLanguage, isVoiceActive, setIsVoiceActive, showToast, t } = useSettings();
  const navigate = useNavigate();

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const liveTranscriptRef = useRef("");

  // Clean up tracks on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startListening = async () => {
    audioChunksRef.current = [];
    liveTranscriptRef.current = "";
    setIsRecording(true);
    setIsVoiceActive(true);

    // Initialize Web Speech API for live transcription if available
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;

        // Set speech recognition language dynamically based on active selection
        if (currentLanguage === "hi") {
          recognition.lang = "hi-IN";
        } else if (currentLanguage === "mr") {
          recognition.lang = "mr-IN";
        } else {
          recognition.lang = "en-US";
        }

        recognition.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map((res) => res[0].transcript)
            .join("");
          liveTranscriptRef.current = transcript;
        };
        recognition.onerror = () => {};
        recognition.onend = () => {};
        recognitionRef.current = recognition;
        recognition.start();
      } catch (e) {
        console.warn("SpeechRecognition not initialized:", e);
      }
    }

    // MediaRecorder API for audio blob capture
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop());
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          await sendAudioToBackend(audioBlob, liveTranscriptRef.current);
        };

        mediaRecorder.start();
      } else {
        // Fallback for browsers without getUserMedia
        setTimeout(() => {
          stopListening();
        }, 3500);
      }
    } catch (err) {
      console.warn("Microphone access denied or error:", err);
      showToast(
        currentLanguage === "hi"
          ? "माइक्रोफ़ोन की अनुमति नहीं दी गई।"
          : currentLanguage === "mr"
          ? "मायक्रोफोन परवानगी नाकारली गेली."
          : "Microphone permission was not granted.",
        3500
      );
      setIsRecording(false);
      setIsVoiceActive(false);
    }
  };

  const stopListening = () => {
    setIsRecording(false);
    setIsVoiceActive(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    } else {
      if (liveTranscriptRef.current) {
        sendAudioToBackend(null, liveTranscriptRef.current);
      }
    }
  };

  const toggleListening = () => {
    if (isRecording) {
      stopListening();
    } else {
      startListening();
    }
  };

  const sendAudioToBackend = async (audioBlob, transcript) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      if (audioBlob) {
        formData.append("file", audioBlob, "voice_command.webm");
        formData.append("audio", audioBlob, "voice_command.webm");
      }
      if (transcript) {
        formData.append("command", transcript);
        formData.append("query", transcript);
      }
      // Strictly append both language and lang fields so any backend parser recognizes it
      formData.append("language", currentLanguage);
      formData.append("lang", currentLanguage);

      const res = await fetch(`/api/voice?lang=${encodeURIComponent(currentLanguage)}`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();

      // Defensive Handling: execute navigation if requested
      if (data && data.action === "navigate" && data.route) {
        navigate(data.route);
        if (onCommandExecuted) {
          onCommandExecuted(data);
        }
      }

      // Show toast message with transcript & server response
      const toastText = data.message || `Command: "${data.transcription}"`;
      showToast(toastText, 4000);
    } catch (err) {
      console.warn("Voice endpoint fallback:", err);
      // Client-side fallback intent routing
      const q = (transcript || "").toLowerCase();
      let targetRoute = "/dashboard";
      let msg = currentLanguage === "hi" ? "कमांड सेंटर डैशबोर्ड पर ले जाया जा रहा है" : currentLanguage === "mr" ? "कमांड सेंटर डॅशबोर्डवर परत जात आहे" : "Returning to dashboard";

      if (q.includes("scenario") || q.includes("simulate") || q.includes("परिदृश्य")) {
        targetRoute = "/scenarios";
        msg = currentLanguage === "hi" ? "मल्टी-पाथ परिदृश्य खोला जा रहा है" : currentLanguage === "mr" ? "मल्टी-पाथ परिदृश्य उघडत आहे" : "Opening Multi-Path Scenarios";
      } else if (q.includes("subscrip") || q.includes("bill") || q.includes("creep") || q.includes("सदस्यता") || q.includes("बिल")) {
        targetRoute = "/subscriptions";
        msg = currentLanguage === "hi" ? "सदस्यता ट्रैकर खोला जा रहा है" : currentLanguage === "mr" ? "सदस्यता ट्रॅकर उघडत आहे" : "Opening Subscriptions Tracker";
      } else if (q.includes("sync") || q.includes("upload") || q.includes("सिंक") || q.includes("अपलोड")) {
        targetRoute = "/data-sync";
        msg = currentLanguage === "hi" ? "डेटा सिंक वॉल्ट खोला जा रहा है" : currentLanguage === "mr" ? "डेटा सिंक व्हॉल्ट उघडत आहे" : "Opening Data Sync Vault";
      } else if (q.includes("transact") || q.includes("लेन") || q.includes("व्यवहार")) {
        targetRoute = "/transactions";
        msg = currentLanguage === "hi" ? "लेन-देन खोला जा रहा है" : currentLanguage === "mr" ? "व्यवहार उघडत आहे" : "Opening Transactions";
      }

      navigate(targetRoute);
      showToast(msg, 3500);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={toggleListening}
        disabled={isProcessing}
        aria-label={isRecording ? t("Stop Listening") : t("Voice Command")}
        title={isRecording ? t("Stop Listening") : t("Voice Command")}
        className={`relative flex items-center justify-center p-2 rounded-full transition-all duration-300 cursor-pointer backdrop-blur-md border shadow-sm select-none ${
          isRecording
            ? "bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/50 ring-4 ring-rose-500/30 scale-105"
            : "bg-white/15 dark:bg-black/20 text-slate-700 dark:text-zinc-200 border-white/25 dark:border-white/10 hover:border-emerald-500/50 hover:text-emerald-700 dark:hover:text-emerald-400 hover:scale-105 active:scale-95"
        }`}
      >
        {isProcessing ? (
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
        ) : isRecording ? (
          <div className="flex items-center gap-1.5 px-1">
            <MicOff className="w-4 h-4 animate-pulse text-rose-600" />
            {/* Animated Soundwave Bars */}
            <div className="flex items-center gap-0.5 h-3">
              <span className="w-0.5 h-full bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-0.5 h-full bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-0.5 h-full bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </button>

      {/* Floating active listening tooltip indicator */}
      {isRecording && (
        <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white shadow-md animate-fade-in pointer-events-none z-50">
          {t("Listening...")}
        </span>
      )}
    </div>
  );
}
