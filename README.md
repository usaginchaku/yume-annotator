# yume-annotator
AI生成夢小説のアノテーションをします。

## DreamGachaから作品を読み込む

1. DreamGachaのライブラリで、対象作品のプロンプト付きJSONを書き出します。
2. 本ツールの「＋ 新規作品」を開きます。
3. 「DreamGachaの作品JSONを読み込む」を選び、書き出したJSONを指定します。

本文に加えて、プロンプト全文・プロンプト版・版ID・キャラクター情報・関係性・シチュエーション・雰囲気・追加条件・夢主設定・生成時設定を読み込みます。既存作品は置き換えません。同じDreamGacha作品IDは重複して読み込みません。

対応形式は `dream-gacha.novel-export` バージョン1です。

## テスト

```sh
node --test test/*.test.js
```
