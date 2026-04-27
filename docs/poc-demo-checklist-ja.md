# PoCデモ実行チェックリスト（審査向け）

## 目的

短時間で「病院分離」と「運用可能性」を見せる。

## 事前準備（5分）

- `npm run dev:node` で起動
- ブラウザで `http://localhost:3000` を開く
- 看護師ログイン `ID=1 / PASS=1` が通ることを確認
- `/settings` で current hospital が表示されることを確認

## 本番デモ手順（7〜10分）

1. **ログイン**
   - `/nurse-login` で `1 / 1` ログイン
   - 画面遷移後、看護ダッシュボードが表示される

2. **病院分離の説明**
   - `/settings` を開く
   - `Current hospital` を見せる
   - `Switch hospital` で病院を切替
   - 切替後にアカウント一覧・監査ログが更新されることを見せる

3. **所属管理（GUI）**
   - 任意の看護師ID行で `target hospital id` を入力
   - `Add membership` を押す
   - エラーなく追加できることを確認

4. **監査ログ**
   - 直近の `auth.login` / `hospital.switch` / `nurse_account.assign_hospital` を表示
   - `Download CSV` を押してエクスポート

5. **既存画面互換**
   - `/dashboard/nurse` や `/dashboard/family` を表示
   - 既存の見た目が大きく変わっていないことを確認

## 合格条件（PoC）

- `ID=1 / PASS=1` で運用導線が壊れていない
- 病院切替ができる
- 病院所属をGUIで追加できる
- 監査ログをCSVで出せる

