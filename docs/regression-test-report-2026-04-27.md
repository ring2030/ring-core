# 軽い回帰テスト記録（2026-04-27）

対象: 限定本番準備の主要導線  
実施者: AIエージェント  
環境: ローカル開発環境

## テスト項目

| ID | 項目 | 期待結果 | 結果 |
|---|---|---|---|
| R1 | ログイン成功 (`1/1`) | セッション発行、ダッシュボード遷移 | PASS |
| R2 | ログイン失敗連続 | 5回失敗で15分ロック | PASS |
| R3 | 初回パスワード変更必須 | ログイン前に変更導線表示 | PASS |
| R4 | 病院切替 | 選択病院へ切替、データ再読込 | PASS |
| R5 | 招待リンク作成 | `hospital_admin` は成功、非adminは403 | PASS |
| R6 | 監査ログCSV | CSVダウンロード可能 | PASS |

## 実行メモ

- 自動品質チェック:
  - `npm run lint` -> エラー 0（既存 warning 4）
  - `npm run run:quality` -> PASS
  - Vitest: 43 tests passed
- APIアクセス制御:
  - `nurse-accounts` の `POST/PATCH` は admin 制限に変更
  - `invite` 作成は admin 制限に変更

## 残課題（次フェーズ）

- Playwright等による完全自動E2E化
- 本番相当データでの負荷時レスポンス確認
- 監査ログ永続化先をDBへ移行

