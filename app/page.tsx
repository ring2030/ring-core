"use client";

import { useEffect, useState, useRef } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";

export default function GrandmaGazePage() {
  const [gazePoint, setGazePoint] = useState({ x: -100, y: -100 });
  const [target, setTarget] = useState<"トイレ" | "お話" | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("カメラを準備しています...");
  
  const [isSuccess, setIsSuccess] = useState(false);
  const [sentReason, setSentReason] = useState("");

  // AIとの会話用の状態
  const [aiText, setAiText] = useState("お話し相手を呼んでいます...");
  const [isListening, setIsListening] = useState(false); // マイクで聞いているか
  
  const [windowWidth, setWindowWidth] = useState(1000);

  // （音声合成バグ回避用）声をロードしておく
  useEffect(() => {
    window.speechSynthesis.getVoices();
  }, []);

  useEffect(() => {
    setWindowWidth(window.innerWidth);
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 1. iframeからの視線データを受信
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'GAZE_UPDATE') {
        setGazePoint({ x: event.data.x, y: event.data.y });
        setStatusMessage("視線を検知中...");
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // 2. 超・当たり判定
  useEffect(() => {
    if (isSuccess || gazePoint.x < 0) return;
    let currentTarget: "トイレ" | "お話" | null = null;
    if (gazePoint.y > window.innerHeight * 0.1) {
      if (gazePoint.x < windowWidth * 0.45) currentTarget = "トイレ";
      else if (gazePoint.x > windowWidth * 0.55) currentTarget = "お話";
    }
    setTarget(currentTarget);
  }, [gazePoint, isSuccess, windowWidth]);

  // 3. 激甘ゲージ
  useEffect(() => {
    if (isSuccess) return;
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (target) {
          const next = prev + 10; 
          if (next >= 100) {
            submitCall(target);
            return 100;
          }
          return next;
        } else {
          return Math.max(0, prev - 1); 
        }
      });
    }, 100);
    return () => clearInterval(interval);
  }, [target, isSuccess]);


  // 4. 🗣️ 【最強】なめらか会話システム
  useEffect(() => {
    if (isSuccess && sentReason === "お話") {
      
      // ブラウザの音声認識（耳）と音声合成（口）を準備
      // @ts-ignore (TypeScriptエラー回避用)
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = SpeechRecognition ? new SpeechRecognition() : null;
      const synth = window.speechSynthesis;

      // 🛑 安全装置：画面を離れたら全てストップ
      let isComponentMounted = true;

      // 👄 AIが喋る関数
      const speakAndListen = (textToSpeak: string) => {
        if (!isComponentMounted) return;
        setAiText(textToSpeak);
        setIsListening(false);

        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = "ja-JP";
        utterance.rate = 1.0;  // 自然な速さ
        utterance.pitch = 1.3; // 若い女性らしい少し高めの声

        // 🌟 Edgeの隠し機能！一番綺麗な声（Nanami）を探す
        const voices = synth.getVoices();
        const bestVoice = 
          voices.find(v => v.name.includes("Nanami") && v.name.includes("Online")) || // Edge最強の声
          voices.find(v => v.name.includes("Nanami")) ||
          voices.find(v => v.name.includes("Google 日本語")) ||
          voices.find(v => v.lang === "ja-JP");
        if (bestVoice) utterance.voice = bestVoice;

        // 喋り終わったら、おばあちゃんの言葉を聞き始める！
        utterance.onend = () => {
          if (recognition && isComponentMounted) {
            setAiText("（お話を聞いています...）");
            setIsListening(true);
            try { recognition.start(); } catch(e) {}
          }
        };

        synth.speak(utterance);
      };

      // 👂 おばあちゃんの言葉を聞き取った時の処理
      if (recognition) {
        recognition.lang = 'ja-JP';
        recognition.interimResults = false; // 確定した言葉だけ取る

        recognition.onresult = (event: any) => {
          const userSaid = event.results[0][0].transcript;
          
          // 本来はここでLLM（Gemini API等）に言葉を送って返事を作りますが、
          // 今回は「相槌を打つ」モックアップ（試作品）として動作させます。
          setTimeout(() => {
            speakAndListen(`「${userSaid}」ですね。うんうん、わかりますよ。もっとお話ししてください。`);
          }, 1000);
        };

        // 何も聞こえなかった時、もう一度問いかける
        recognition.onerror = () => {
          if (isComponentMounted) {
            setTimeout(() => speakAndListen("きよ子さん、お声が遠いようです。もう一度お願いできますか？"), 2000);
          }
        };
      } else {
        setAiText("マイクが使えないブラウザのようです。");
      }

      // 🎬 最初の挨拶をスタート！
      setTimeout(() => {
        speakAndListen("きよ子さん、どうしました？ なにかありましたか？");
      }, 800);

      // クリーンアップ（画面を閉じた時に黙らせる）
      return () => {
        isComponentMounted = false;
        synth.cancel();
        if (recognition) recognition.abort();
      };
    }
  }, [isSuccess, sentReason]);


  // 5. 送信＆分岐ロジック
  const submitCall = async (reason: string) => {
    setIsSuccess(true);
    setSentReason(reason);
    
    if (reason === "トイレ") {
      try {
        await addDoc(collection(getFirestoreDb(), "calls"), {
          理由: [reason],
          特記事項: "視線入力からの自動送信",
          送信者: "きよ子",
          送信日時: serverTimestamp(),
        });
      } catch (err) {}
      setTimeout(() => resetToMain(), 5000);
    }
  };

  const resetToMain = () => {
    window.speechSynthesis.cancel(); // 喋ってたら強制ストップ
    setIsSuccess(false);
    setProgress(0);
    setTarget(null);
    setGazePoint({ x: -100, y: -100 });
    setStatusMessage("視線を検知中...");
  };

  return (
    <div className="relative min-h-screen bg-orange-50 font-sans overflow-hidden select-none flex flex-col items-center justify-center">
      <iframe src="/gaze-core.html" className="absolute top-0 left-0 w-full h-full opacity-0 pointer-events-none" />

      {!isSuccess && (
        <div 
          className="fixed w-48 h-48 rounded-full bg-yellow-300 opacity-50 mix-blend-multiply pointer-events-none transition-all duration-100 blur-2xl animate-pulse"
          style={{ left: gazePoint.x - 96, top: gazePoint.y - 96, display: gazePoint.x > 0 ? 'block' : 'none', zIndex: 9999 }}
        />
      )}

      {isSuccess ? (
        <div className="flex flex-col items-center justify-center animate-in zoom-in duration-500 w-full h-full px-8">
          {sentReason === "トイレ" ? (
            <div className="bg-white p-24 rounded-[4rem] shadow-2xl text-center border-8 border-orange-200">
              <h1 className="text-[6rem] font-black text-orange-600 mb-8 leading-tight">みっちゃんさんに<br/>伝えましたよ！</h1>
              <p className="text-[3rem] font-bold text-gray-700">すぐに行くから、待っててね。</p>
            </div>
          ) : (
            /* 🗣️ AIお話し画面 */
            <div className="flex flex-col items-center justify-center w-full max-w-5xl">
              {/* マイクがオンの時は赤く光るインジケーター */}
              <div className={`mb-8 px-8 py-4 rounded-full text-2xl font-bold transition-colors ${isListening ? 'bg-red-100 text-red-600 border-2 border-red-300 animate-pulse' : 'bg-transparent text-transparent'}`}>
                🔴 あなたの声を聴いています...
              </div>

              <h1 className="text-[3.5rem] font-black text-blue-700 mb-16 text-center leading-snug break-words w-full px-8">
                {aiText}
              </h1>
              
              <div className="relative w-80 h-80 flex items-center justify-center mb-20">
                <div className={`absolute inset-0 rounded-full blur-3xl transition-all duration-700 ${isListening ? 'bg-red-200 animate-pulse scale-110' : 'bg-blue-200 animate-[pulse_3s_ease-in-out_infinite]'}`}></div>
                <div className="relative w-64 h-64 bg-gradient-to-br from-blue-100 to-white border-8 border-blue-200 rounded-full shadow-2xl flex items-center justify-center animate-[bounce_4s_ease-in-out_infinite]">
                  <div className="text-[5rem] text-blue-300 font-bold">AI</div>
                </div>
              </div>

              <button onClick={resetToMain} className="px-16 py-8 bg-gray-200 hover:bg-gray-300 text-gray-700 text-[3rem] font-bold rounded-full shadow-md active:scale-95 transition-all">
                おわる（最初の画面にもどる）
              </button>
            </div>
          )}
        </div>
      ) : (
        /* メイン画面 */
        <div className="w-full h-full px-12 flex flex-col items-center justify-center">
          <div className="text-center absolute top-8">
            <p className="text-2xl font-bold text-gray-500 bg-white/80 inline-block px-8 py-3 rounded-full shadow-sm">{statusMessage}</p>
          </div>
          <div className="flex flex-row gap-16 w-full h-[70vh] max-w-7xl mx-auto mt-16">
            <div className={`flex-1 rounded-[4rem] border-[12px] transition-all duration-300 relative overflow-hidden flex items-center justify-center ${target === "トイレ" ? "border-orange-500 bg-orange-100 scale-[1.02] shadow-2xl" : "border-orange-200 bg-white shadow-md"}`}>
              <div className="absolute bottom-0 left-0 w-full bg-orange-400 opacity-40" style={{ height: `${target === "トイレ" ? progress : 0}%`, transition: 'height 0.1s linear' }}></div>
              <span className="text-[12rem] font-black text-gray-800 relative z-10 pointer-events-none">トイレ</span>
            </div>
            <div className={`flex-1 rounded-[4rem] border-[12px] transition-all duration-300 relative overflow-hidden flex items-center justify-center ${target === "お話" ? "border-blue-500 bg-blue-100 scale-[1.02] shadow-2xl" : "border-blue-200 bg-white shadow-md"}`}>
              <div className="absolute bottom-0 left-0 w-full bg-blue-400 opacity-40" style={{ height: `${target === "お話" ? progress : 0}%`, transition: 'height 0.1s linear' }}></div>
              <span className="text-[12rem] font-black text-gray-800 relative z-10 pointer-events-none">お話</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}