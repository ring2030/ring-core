"use client";

type Props = {
  aiText: string;
  isListening: boolean;
  isThinking: boolean;
  onEnd: () => void;
};

export function ConversationView({ aiText, isListening, isThinking, onEnd }: Props) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full px-8 animate-in zoom-in duration-500">
      <div className="flex flex-col items-center w-full max-w-5xl">
        <div
          className={`mb-8 px-8 py-4 rounded-full text-2xl font-bold transition-colors ${
            isListening
              ? "bg-red-900/50 text-red-400 border-2 border-red-700 animate-pulse"
              : isThinking
                ? "bg-blue-900/50 text-blue-400 border-2 border-blue-700 animate-bounce"
                : "bg-transparent text-transparent"
          }`}
        >
          {isListening ? "🔴 声を聴いています..." : isThinking ? "🧠 考えています..." : ""}
        </div>
        <h1 className="text-[3.5rem] font-black text-blue-300 mb-16 text-center leading-snug w-full px-8 min-h-[10rem]">
          {aiText}
        </h1>
        <div className="relative w-80 h-80 flex items-center justify-center mb-20">
          <div
            className={`absolute inset-0 rounded-full blur-3xl transition-all duration-700 ${
              isListening
                ? "bg-red-900 animate-pulse scale-110"
                : isThinking
                  ? "bg-yellow-900"
                  : "bg-blue-900 animate-[pulse_3s_ease-in-out_infinite]"
            }`}
          />
          <div className="relative w-64 h-64 bg-gradient-to-br from-blue-900 to-slate-800 border-8 border-blue-700/60 rounded-full shadow-2xl flex items-center justify-center animate-[bounce_4s_ease-in-out_infinite]">
            <div className="text-[5rem] text-blue-400 font-bold">AI</div>
          </div>
        </div>
        <button
          onClick={onEnd}
          className="px-16 py-8 bg-slate-700 text-slate-200 text-[3rem] font-bold rounded-full shadow-md active:scale-95 transition-all hover:bg-slate-600"
        >
          おわる
        </button>
      </div>
    </div>
  );
}
