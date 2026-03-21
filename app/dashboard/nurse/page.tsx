"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  query, 
  onSnapshot, 
  orderBy 
} from "firebase/firestore";
import { 
  PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer
} from "recharts";
import { 
  Activity, Clock, CheckCircle2, Heart, 
  LayoutDashboard, TrendingUp, AlertCircle,
  Bell, ShieldCheck, Users, Volume2, Info, Wifi, WifiOff
} from "lucide-react";

// --- Firebase初期設定 ---
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof window !== 'undefined' && (window as any).__app_id ? (window as any).__app_id : 'default-app-id';

const COLORS = {
  "トイレ": "#fb923c",
  "お話": "#60a5fa",
  "痛い": "#f87171",
  "寂しい": "#c084fc",
  "その他": "#94a3b8"
};

export default function NurseDashboard() {
  const [user, setUser] = useState<any>(null);
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const isInitialLoad = useRef(true);

  // 🔊 ナースコール音（Web Audio API）
  const playChime = () => {
    if (!isAudioEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(660, audioCtx.currentTime);
      gain1.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start();
      osc1.stop(audioCtx.currentTime + 0.5);
    } catch (e) { console.error(e); }
  };

  // 🔑 1. 認証（名無しパスポートの発行）
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err: any) {
        console.error("Auth error:", err);
        setError("認証エラー：Firebaseで『匿名ログイン』を有効にしてください。");
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 📞 2. リアルタイム・ホットライン（常時接続）
  useEffect(() => {
    if (!user) return;
    
    // データがある場所を指定
    const callsRef = collection(db, 'artifacts', appId, 'public', 'data', 'calls');
    const q = query(callsRef, orderBy("送信日時", "desc"));

    // 🚀 ここが「常時読み込み」の心臓部！
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setIsOnline(true);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().送信日時?.toDate() || new Date()
      }));

      // 新しい呼び出しがあったら音を鳴らす！
      if (!isInitialLoad.current && snapshot.docChanges().some(change => change.type === "added")) {
        playChime();
      }
      isInitialLoad.current = false;
      setCalls(data);
      setLoading(false); // 最初の1回が届いたら、もう読み込み画面は出さない！
    }, (err) => {
      console.error("Firestore error:", err);
      setIsOnline(false);
    });

    return () => unsubscribe();
  }, [user, isAudioEnabled]);

  // 3. データ集計（数秒に1回でOKなので効率化）
  const stats = useMemo(() => {
    const reasonCounts: any = { "トイレ": 0, "お話": 0, "痛い": 0, "寂しい": 0, "その他": 0 };
    const hourlyData: any = Array(24).fill(0).map((_, i) => ({ hour: `${i}時`, count: 0 }));

    calls.forEach(call => {
      const reasonRaw = Array.isArray(call.理由) ? call.理由[0] : call.理由;
      const key = reasonCounts[reasonRaw] !== undefined ? reasonRaw : "その他";
      reasonCounts[key]++;
      const hour = call.date.getHours();
      hourlyData[hour].count++;
    });

    const pieData = Object.keys(reasonCounts).map(name => ({ name, value: reasonCounts[name] })).filter(d => d.value > 0);
    return { pieData, hourlyData, total: calls.length };
  }, [calls]);

  // 🚑 致命的なエラー時
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#020617] text-white p-10">
        <AlertCircle className="w-20 h-20 text-red-500 mb-6 animate-pulse" />
        <h1 className="text-3xl font-black mb-4 uppercase">System Blocked</h1>
        <p className="text-slate-400 text-center max-w-md mb-8">{error}</p>
        <button onClick={() => window.location.reload()} className="px-10 py-4 bg-blue-600 rounded-full font-black shadow-lg shadow-blue-500/20 hover:scale-105 transition-transform">REBOOT SYSTEM</button>
      </div>
    );
  }

  // ⏳ 最初の接続時のみ表示
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#020617]">
        <div className="relative w-24 h-24 mb-6">
          <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
        <p className="text-blue-400 font-black tracking-widest animate-pulse">CONNECTING TO RING-CORE...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 p-6 md:p-10 font-sans selection:bg-blue-500/30">
      
      {/* 🔊 ブラウザの音ブロックを解除するボタン */}
      {!isAudioEnabled && (
        <div className="fixed top-0 left-0 w-full bg-indigo-600 text-white py-3 px-6 z-[100] flex justify-between items-center shadow-2xl animate-in slide-in-from-top duration-500">
          <p className="font-bold flex items-center gap-2 text-sm sm:text-base">
            <Volume2 className="w-5 h-5 animate-bounce" /> 呼び出し音を有効にするには、右のボタンを押してください
          </p>
          <button onClick={() => { setIsAudioEnabled(true); playChime(); }} className="bg-white text-indigo-600 px-6 py-2 rounded-full font-black text-xs sm:text-sm shadow-xl active:scale-90 transition-transform">
            音声を有効化
          </button>
        </div>
      )}

      {/* 🚀 ヘッダー：通信状態も表示！ */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-500/20 p-2 rounded-2xl border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
              <LayoutDashboard className="w-8 h-8 text-blue-400" />
            </div>
            <h1 className="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
              ring COMMAND CENTER
            </h1>
          </div>
          <div className="flex items-center gap-4 ml-1">
            <p className={`text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1.5 ${isOnline ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isOnline ? 'LIVE CONNECTION' : 'OFFLINE'}
            </p>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-500/50" /> Secure Protocol v1.2
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
          <div className="bg-slate-900/60 border border-white/5 p-4 rounded-3xl flex items-center gap-4 shadow-2xl backdrop-blur-md">
            <div className="bg-orange-500/10 p-2 rounded-full">
              <Activity className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total</p>
              <p className="text-2xl font-black text-white leading-none">{stats.total}</p>
            </div>
          </div>
          <div className="bg-slate-900/60 border border-white/5 p-4 rounded-3xl flex items-center gap-4 shadow-2xl backdrop-blur-md">
            <div className="bg-blue-500/10 p-2 rounded-full">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Operator</p>
              <p className="text-xs font-black text-slate-300">NURSE-A</p>
            </div>
          </div>
        </div>
      </header>

      {/* 📊 グラフエリア */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-[60px] group-hover:bg-orange-500/10 transition-colors"></div>
          <h2 className="text-sm font-black mb-8 flex items-center gap-3 text-slate-400 uppercase tracking-widest">
            <TrendingUp className="w-4 h-4 text-orange-400" />
            CALL REASON ANALYSIS
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.pieData} innerRadius={65} outerRadius={85} paddingAngle={8} dataKey="value" stroke="none">
                  {stats.pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || COLORS["その他"]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '16px', color: '#fff', fontSize: '12px', fontWeight: 'bold' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-6">
            {stats.pieData.map((d) => (
              <div key={d.name} className="flex items-center gap-2.5 p-2.5 bg-white/5 rounded-2xl border border-white/5">
                <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: COLORS[d.name as keyof typeof COLORS], color: COLORS[d.name as keyof typeof COLORS] }} />
                <span className="text-[10px] font-black text-slate-400">{d.name}</span>
                <span className="text-xs font-black text-white ml-auto">{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-900/40 backdrop-blur-xl border border-white/5 p-8 rounded-[3rem] shadow-2xl">
          <h2 className="text-sm font-black mb-8 flex items-center gap-3 text-slate-400 uppercase tracking-widest">
            <Clock className="w-4 h-4 text-blue-400" />
            HOURLY ACTIVITY MONITOR
          </h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.hourlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 10, fontWeight: 'bold'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 10, fontWeight: 'bold'}} />
                <Tooltip cursor={{fill: 'rgba(255,255,255,0.02)'}} contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '16px' }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} animationDuration={2000} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 📝 ログ：ここも自動更新！ */}
      <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 p-8 rounded-[3rem] shadow-2xl">
        <div className="flex justify-between items-center mb-8 px-2">
          <h2 className="text-sm font-black flex items-center gap-3 text-slate-400 uppercase tracking-widest">
            <Bell className="w-4 h-4 text-green-400 animate-pulse" />
            LIVE ACTIVITY LOG
          </h2>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Monitoring</span>
          </div>
        </div>
        <div className="overflow-hidden rounded-[2.5rem] border border-white/5">
          <table className="w-full text-left text-[11px] sm:text-xs">
            <thead className="bg-white/5">
              <tr>
                <th className="p-5 font-black text-slate-500 uppercase tracking-widest">Timestamp</th>
                <th className="p-5 font-black text-slate-500 uppercase tracking-widest">Action</th>
                <th className="p-5 font-black text-slate-500 uppercase tracking-widest">Priority</th>
                <th className="p-5 font-black text-slate-500 uppercase tracking-widest">Device Log</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-bold">
              {calls.slice(0, 12).map((call) => (
                <tr key={call.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="p-5 font-mono text-blue-400/70">
                    {call.date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="p-5">
                    <span className="px-4 py-1.5 rounded-full text-[9px] font-black text-white shadow-lg shadow-black/40" 
                          style={{ backgroundColor: COLORS[call.理由 as keyof typeof COLORS] || COLORS["その他"] }}>
                      {call.理由}
                    </span>
                  </td>
                  <td className="p-5">
                    {call.理由 === "痛い" ? (
                      <span className="flex items-center gap-2 text-red-400 bg-red-400/10 px-3 py-1.5 rounded-xl w-fit border border-red-500/20">
                        <AlertCircle className="w-3.5 h-3.5" /> URGENT
                      </span>
                    ) : call.理由 === "寂しい" ? (
                      <span className="flex items-center gap-2 text-purple-400 bg-purple-400/10 px-3 py-1.5 rounded-xl w-fit border border-purple-500/20">
                        <Heart className="w-3.5 h-3.5" /> SUPPORT
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 text-green-400 bg-green-400/10 px-3 py-1.5 rounded-xl w-fit border border-green-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" /> ROUTINE
                      </span>
                    )}
                  </td>
                  <td className="p-5 text-slate-600 font-medium italic group-hover:text-slate-400 transition-colors">
                    {call.特記事項 || "Secure event recorded"}
                  </td>
                </tr>
              ))}
              {calls.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-24 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-20">
                      <Info className="w-16 h-16" />
                      <p className="text-xl font-black uppercase tracking-[0.3em]">No Calls Detected</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}