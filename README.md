# MeetHost — InfinityFree ডিপ্লয়মেন্ট গাইড

এই ফোল্ডারে একটি **সম্পূর্ণ স্ট্যাটিক ভিডিও কনফারেন্সিং ওয়েব অ্যাপ** আছে যেটা **InfinityFree** (বা যেকোনো স্ট্যাটিক হোস্টিং)-এ সরাসরি আপলোড করলেই চলবে। Firebase Realtime Database সিগন্যালিং ও রুম স্টেটের জন্য ব্যবহৃত হয়েছে, WebRTC পিয়ার-টু-পিয়ার মিডিয়ার জন্য।

## ফাইলসমূহ
- `index.html` — মূল HTML (landing + lobby + meeting ভিউ)
- `styles.css` — সব স্টাইল (ডার্ক/লাইট থিম, রেসপন্সিভ)
- `app.js` — পুরো অ্যাপ লজিক (Firebase + WebRTC)
- `firebase-config.js` — তোমার Firebase কনফিগ

## ফিচার
- ✅ রুম তৈরি/জয়েন (৬-ডিজিট কোড, লিংক শেয়ার)
- ✅ মাল্টি-পার্টিসিপেন্ট ভিডিও (WebRTC mesh, ৪-৬ জন)
- ✅ হোস্ট কন্ট্রোল (mute all, kick, lock, chat/screen toggle, waiting room, recording, host transfer)
- ✅ চ্যাট (গ্রুপ + সিস্টেম মেসেজ)
- ✅ রিয়েকশন (ফ্লোটিং ইমোজি) + হ্যান্ড রেইজ
- ✅ পোল (লাইভ ভোট, ক্লোজ)
- ✅ স্ক্রিন শেয়ার
- ✅ ওয়েটিং রুম (অ্যাডমিট/ডিনাই)
- ✅ বাইলিঙ্গুয়াল (বাংলা + English)
- ✅ ডার্ক/লাইট থিম
- ✅ কীবোর্ড শর্টকাট (M/V/R/S/C/P/E/L)
- ✅ মোবাইল রেসপন্সিভ

---

## ধাপ ১: Firebase সেটআপ (গুরুত্বপূর্ণ!)

তোমার Firebase project (`softmax-10bd4`) তৈরি আছে। শুধু নিচের কাজগুলো করতে হবে:

### ১.১ Anonymous Authentication চালু করো
1. https://console.firebase.google.com → তোমার project (`softmax-10bd4`)
2. **Authentication** → **Sign-in method**
3. **Anonymous** → **Enable** → সেভ করো

### ১.২ Realtime Database তৈরি করো
1. **Build** → **Realtime Database** → **Create Database**
2. Location: **Singapore** (asia-southeast1) — তোমার PRD-এ এটাই ছিল
3. **Start in test mode** (পরে rules সেট করবো)

### ১.৩ Database Rules সেট করো (গুরুত্বপূর্ণ — নাহলে কাজ করবে না)
**Realtime Database** → **Rules** tab-এ যাও এবং নিচের JSON পেস্ট করে **Publish** করো:

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": "auth != null",
        ".write": "auth != null",
        "hostId": {
          ".write": "auth != null && (!data.exists() || data.val() === auth.uid || root.child('rooms').child($roomId).child('hostId').val() === auth.uid)"
        },
        "participants": {
          "$uid": {
            ".write": "auth != null && ($uid === auth.uid || root.child('rooms').child($roomId).child('hostId').val() === auth.uid || root.child('rooms').child($roomId).child('participants').child(root.child('rooms').child($roomId).child('hostId').val()).child('role').val() === 'cohost')"
          }
        },
        "waitingRoom": {
          "$uid": {
            ".write": "auth != null && ($uid === auth.uid || root.child('rooms').child($roomId).child('hostId').val() === auth.uid)"
          }
        },
        "signal": {
          "$uid": {
            ".read": "auth != null && auth.uid === $uid",
            ".write": "auth != null"
          }
        },
        "chat": {
          ".read": "auth != null",
          "$msgId": {
            ".write": "auth != null"
          }
        },
        "polls": {
          ".read": "auth != null",
          "$pollId": {
            ".write": "auth != null && (root.child('rooms').child($roomId).child('hostId').val() === auth.uid || !data.exists())"
          }
        }
      }
    }
  }
}
```

> ⚠️ এই rules গুলো anonymous auth সহ যেকোনো ইউজারকে রুম তৈরি/জয়েন করতে দেয়। প্রোডাকশনে যাওয়ার আগে আরও কড়া করতে পারবে।

---

## ধাপ ২: InfinityFree-এ আপলোড

### ২.১ InfinityFree অ্যাকাউন্ট ও সাইট তৈরি
1. https://infinityfree.com → **Register** (ফ্রি অ্যাকাউন্ট)
2. লগইন করে **Create New Account** → একটা ফ্রি `.epizy.com` বা `.rf.gd` সাবডোমেইন নাও (যেমন `meethost.epizy.com`)
3. অ্যাকাউন্ট তৈরি হলে **Control Panel**-এ যাও

### ২.২ FTP দিয়ে ফাইল আপলোড (সবচেয়ে সহজ)
১. InfinityFree Control Panel → **FTP Accounts** → FTP ইউজারনেম + পাসওয়ার্ড নাও
২. একটা FTP ক্লায়েন্ট ডাউনলোড করো (যেমন **FileZilla** — https://filezilla-project.org)
৩. FileZilla-তে কানেক্ট করো:
   - **Host:** `ftp.infinityfree.com` (বা তোমার অ্যাকাউন্টের FTP address)
   - **Username:** তোমার FTP ইউজারনেম
   - **Password:** তোমার FTP পাসওয়ার্ড
   - **Port:** `21`
৪. কানেক্ট হলে ডান পাশে `htdocs` ফোল্ডারে যাও
৫. বাঁ পাশ থেকে এই ৪টা ফাইল `htdocs`-এ ড্র্যাগ করে আপলোড করো:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `firebase-config.js`

### ২.৩ অনলাইনে চেক করো
ব্রাউজারে যাও: `https://তোমার-সাইট.epizy.com/` — অ্যাপ চলবে! 🎉

---

## ধাপ ৩: কাস্টম ডোমেইন (অপশনাল)

InfinityFree-এ ফ্রি SSL সার্টিফিকেট দেয়। Control Panel → **SSL/TLS** → তোমার ডোমেইনের জন্য SSL চালু করো (ভিডিও কলের জন্য HTTPS বাধ্যতামূলক — ক্যামেরা শুধু HTTPS-এ কাজ করে)।

---

## লোকালে টেস্ট করা

InfinityFree-এ আপলোড করার আগে লোকালে টেস্ট করতে পারো:

```bash
# এই ফোল্ডারে যাও
cd infinityfree-build

# যেকোনো স্ট্যাটিক সার্ভার চালাও
python3 -m http.server 8080
# অথবা
npx serve .
```

ব্রাউজারে যাও: `http://localhost:8080`

> ⚠️ লোকাল `http://` তে ক্যামেরা কাজ করবে, কিন্তু পাবলিক `http://` সাইটে কাজ করবে না। তাই InfinityFree-তে আপলোড করে **HTTPS** লিংক ব্যবহার করবে।

---

## সীমাবদ্ধতা

- **Mesh WebRTC:** ৬ জনের বেশি হলে ব্যান্ডউইথ সমস্যা হতে পারে (PRD-এ উল্লেখ আছে)। বেশি স্কেল করতে চাইলে LiveKit/mediasoup SFU লাগবে।
- **Firebase Spark plan (ফ্রি):** প্রতিদিন ১ GB Realtime DB read + সীমিত কানেকশন। ছোট গ্রুপের জন্য যথেষ্ট।
- **Firebase Anonymous auth:** গেস্ট ইউজার লগইন ছাড়াই ঢুকতে পারবে।
- **Recording:** শুধু indicator (প্রকৃত রেকর্ডিং ক্লায়েন্ট-সাইডে MediaRecorder API দিয়ে করতে হবে — এই ভার্সনে নেই)।

---

## ট্রাবলশুটিং

| সমস্যা | সমাধান |
|--------|--------|
| "Firebase auth failed" | Firebase Console → Authentication → Anonymous চালু আছে কিনা দেখো |
| রুম তৈরি হচ্ছে না | Realtime Database rules ঠিকমতো সেট করা আছে কিনা দেখো (ধাপ ১.৩) |
| ক্যামেরা কাজ করছে না | HTTPS ব্যবহার করছ কিনা দেখো। InfinityFree-এ SSL চালু করো |
| অন্য কেউ জয়েন করতে পারছে না | একই কোড দিয়ে জয়েন করছে কিনা, রুম লক করা না কিনা চেক করো |
| WebRTC কানেকশন হচ্ছে না | ফায়ারওয়াল/NAT-এর জন্য TURN সার্ভার লাগতে পারে (ফ্রি: https://www.metered.ca) |

---

## পরবর্তী উন্নয়নের আইডিয়া
- [ ] TURN সার্ভার যোগ করা (NAT ট্রাভার্সাল)
- [ ] প্রাইভেট চ্যাট (1-to-1)
- [ ] ক্লায়েন্ট-সাইড রেকর্ডিং (MediaRecorder API)
- [ ] Breakout rooms
- [ ] Whiteboard (collaborative drawing)
- [ ] লাইভ ক্যাপশন (Web Speech API)

---

তৈরি হয়ে গেলে ব্রাউজারে টেস্ট করে দেখো — কোনো সমস্যা হলে বলো। 🚀
