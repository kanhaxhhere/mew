# Baatchit 🐱 — Chat UX Upgrade (v3)

Chat ka poora UI/UX upgrade — timestamps, reply, forward, copy, save, delete, chat-header se profile, chat delete/mute. **Supabase project, tables, RLS policies — kuch bhi nahi chheda gaya.** `config.js` same hai.

## Kya-kya add hua

| Feature | Status |
|---|---|
| Message timestamp (12hr, AM/PM) | ✅ Full — existing `created_at` column use kiya |
| Long-press action menu (mobile) / right-click (desktop) | ✅ Full |
| Copy message | ✅ Full |
| Reply to message (with jump-to-original) | ✅ Full — persists across reloads/devices |
| Forward message | ✅ Full — persists, kisi ko bhi bhej sakte ho |
| Chat header tap → friend's profile (naam, username, bio, friends count) | ✅ Full — jo data available hai wahi dikhta hai |
| Save/bookmark message | ⚠️ **Sirf is device/browser tak** (local only) |
| Delete message | ⚠️ **"Delete for me" — sirf tumhare view se hata, DB se nahi** |
| Delete/Mute chat (long-press a chat) | ⚠️ **Local hide — Chats list se hat jaati hai, dobara us insaan se message aane/bhejne par wapas aa jaati hai** |

## Reply/Forward kaise kaam karta hai bina naya column banaye

`messages` table mein sirf `text` column hai — koi `reply_to` ya `forwarded_from` column nahi hai, aur maine koi migration nahi chalayi. Iski jagah, jab tum Reply ya Forward karte ho, uska poora context (kisko reply/forward kar rahe ho, kya text tha) **existing `text` column ke andar hi ek chhota JSON ke roop mein store hota hai**. Jab message load hota hai, app check karta hai ki wo JSON hai ya plain text:
- Plain text → normal message dikhta hai (purane sab messages waise hi chalenge)
- JSON with reply/forward marker → quote/forward label ke saath dikhta hai

Isse **backend bilkul same rehta hai**, sirf frontend ne existing column ka smart use kiya hai.

## Jo cheezein sach mein backend ke bina 100% possible nahi thi (isliye local-only hain)

- **Save**: koi saved-messages table nahi hai → sirf tumhare is phone/browser mein yaad rehta hai (localStorage). Dusre device se login karoge to nahi dikhega.
- **Delete message**: `messages` table ka RLS **delete allow nahi karta** (maine check kiya — sirf read + insert policy hai). Isliye "Delete" asal mein message ko sirf tumhare screen se hata deta hai — doosra insaan use dekhta rahega. Agar tumhe real delete chahiye (dono taraf se), backend mein ek delete RLS policy add karni padegi — bolo to bata dena, main karunga (isme Supabase change involve hoga).
- **Delete chat**: same reason — sirf tumhari Chats list se hata, messages database mein rehte hain.

## Files jo change hui

- `index.html` — reply bar, action sheets (bottom sheets), forward modal, delete-chat confirm, friend-profile overlay, clickable chat header
- `style.css` — sabke styles + long-press-safe (no accidental text-select), safe-area respecting sheets
- `script.js` — sab logic; Supabase calls sirf wahi hain jo pehle se the (select/insert), koi naya table/column reference nahi
- `config.js` — **bilkul nahi chheda**

## GitHub pe upload

Existing repo mein `index.html`, `style.css`, `script.js` replace kardo (same naam se upload karoge to overwrite ho jayegi). `config.js` aur `README.md` chhodo, unmein kuch nahi badla.
