# 股票回本成本記錄器：部署步驟

## 1. 建立 Supabase 專案

1. 到 https://supabase.com/dashboard 建立帳號並新增一個 Project。
2. 專案建立完成後，開啟 **SQL Editor**，貼上並執行 `schema.sql` 的全部內容。
3. 到 **Authentication → URL Configuration**：
   - 暫時將 Site URL 設為 `http://localhost:8000`，部署後改成正式網站網址。
   - 將正式網站網址加入 Redirect URLs。
4. 到 **Settings → API**，複製 Project URL 和 anon public key。
5. 將兩個值貼到 `config.js` 的 `SUPABASE_URL` 與 `SUPABASE_ANON_KEY`。

## 2. 本機測試

在這個資料夾執行：

```bash
python3 -m http.server 8000
```

開啟 http://localhost:8000。輸入 Email 後，到信箱點登入連結即可測試。

## 3. 用 GitHub Pages 部署與分享

1. 在 GitHub 建立新的 repository，例如 `stock-cost-tracker`。
2. 將此資料夾內的全部檔案（包括 `.nojekyll`）上傳到 repository 的 `main` 分支根目錄。
3. 到 repository 的 **Settings → Pages**，在 **Build and deployment** 選擇 **Deploy from a branch**，並選擇 `main` / `root` 後儲存。
4. GitHub 會提供網址，通常是 `https://你的帳號.github.io/stock-cost-tracker/`。

部署完成後：

1. 將 Supabase 的 Site URL 改成你的正式網址。
2. 將同一網址加入 Redirect URLs。
3. 重新部署（若 `config.js` 內仍是本機設定）。

`config.js` 的 anon public key 可以放在靜態網站中；**不要**放入 Supabase 的 service role / secret key。GitHub Pages 網站本身是公開可存取的，真正的資料保護依賴 Supabase 的登入與 RLS 規則。

每位使用者以自己的 Email 登入後，只能讀寫自己建立的股票與交易資料；Row Level Security 已在 `schema.sql` 中設定。

## 回本平均成本

`（原有總成本 + 所有買入金額 − 所有賣出金額）÷ 目前持有股數`

此數字反映累積淨投入，適合追蹤回本門檻；它不等同券商或稅務上的成本基礎。
