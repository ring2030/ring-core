/**
 * seeso の InitializationErrorType に対応するユーザー向け文言（SDK 内部コードと数値は固定）
 * @see node_modules/seeso/dist/seeso.js → error-type.js
 */
export function describeEyedidInitError(code: number): string {
  switch (code) {
    case 0:
      return "";
    case 1:
      return [
        "Eyedid の WASM 初期化に失敗しました（開発者ライセンス自体は問題ないことが多いです）。",
        "次を試してください：① 開発サーバーを一度止めて `npm run dev` で再起動し、強制再読み込み（Ctrl+Shift+R）。",
        "② 広告ブロック・追跡防止をオフにする。③ 別ブラウザ（Chrome 最新）で開く。",
        "④ F12 → Network で `cdn.seeso.io` がブロックされていないか確認。",
      ].join("");
    case 2:
      return "カメラ権限が Eyedid SDK 側で拒否されました。ブラウザでカメラを許可してから再度お試しください。";
    case 3:
      return "ライセンスキーが無効です。Eyedid コンソールのキーをコピーし直し、.env.local の NEXT_PUBLIC_EYEDID_LICENSE_KEY を確認してください。";
    case 4:
      return "開発用ライセンスを本番環境で使っています。localhost では「開発用」キー、本番 URL では「本番用」キーをそれぞれ発行してください。";
    case 5:
      return "本番用ライセンスを開発環境（localhost 等）で使っています。Eyedid コンソールで「開発用」キーを発行し、.env.local に設定してください。";
    case 6:
      return "パッケージ名がライセンスと一致しません（主にモバイルアプリ向け）。Web ではキー種別の違いが多いです。";
    case 7:
      return "アプリ署名がライセンスと一致しません（モバイル向け）。";
    case 8:
      return "無料枠の利用上限に達しています。Eyedid コンソールでプランを確認してください。";
    case 9:
      return "ライセンスが無効化されています。コンソールでキーの状態を確認してください。";
    case 10:
      return "認証に失敗しました（IP 制限や通信の暗号化など）。ネットワーク・VPN・時刻を確認してください。";
    case 11:
      return "認証で不明なエラーが発生しました。しばらくしてから再度お試しください。";
    case 12:
      return "Eyedid サーバー側エラー（タイムアウト等）です。しばらくしてから再度お試しください。";
    case 13:
      return "Eyedid サーバーに接続できません。インターネット接続とファイアウォールを確認してください。";
    case 14:
      return "パソコンの時刻が大きくずれています。OS の「日付と時刻」を自動で合わせてから再度お試しください。";
    case 15:
      return "ライセンスキーの形式が正しくありません。コピー漏れ・余分な空白がないか .env.local を確認してください。";
    case 16:
      return "ライセンスの有効期限が切れています。Eyedid コンソールで更新してください。";
    default:
      return `Eyedid の初期化に失敗しました（コード: ${code}）。ライセンス種別・ネットワーク・時刻を確認してください。`;
  }
}
