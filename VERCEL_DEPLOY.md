# คำแนะนำการนำโปรเจกต์ขึ้น Vercel / Cloud

## ข้อจำกัดของ Vercel กับระบบ WebSocket
**Vercel ไม่รองรับ Persistent WebSocket โดยตรง** เนื่องจาก:
1. Vercel ทำงานแบบ **Serverless Functions** (มี Timeout ตัดการเชื่อมต่อภายใน 10-60 วินาที)
2. Serverless แต่ละ Instance ทำงานแยกกัน ไม่แชร์ Memory ทำให้เก็บตัวแปรห้อง (Room) และจำนวนคนดูสด (Live Viewers) ไม่ตรงกัน

---

## 2 ทางเลือกที่ดีและง่ายที่สุด

### ทางเลือกที่ 1: ใช้ Render.com หรือ Railway (แนะนำที่สุด — ฟรี & ไม่ต้องแก้โค้ดเลย)
เนื่องจากโปรเจกต์นี้เขียนด้วย Node.js + WebSocket แบบสมบูรณ์แล้ว คุณสามารถเอาขึ้นโฮสต์ที่รองรับ Node.js Long-running process ได้ทันทีฟรี:

1. **Render.com** (ฟรี):
   - สมัครบัญชีที่ [render.com](https://render.com)
   - เชื่อมต่อกับ GitHub Repo ของคุณ
   - เลือก **New Web Service**
   - ตั้งค่า:
     - **Build Command:** `npm install`
     - **Start Command:** `node server.js`
   - ได้ URL ใช้งานทันที เช่น `https://realtime-wheel.onrender.com` รองรับ WebSocket ทันที 100%

2. **Railway.app** หรือ **Fly.io**:
   - Push โค้ดขึ้นไป ระบบจะตรวจพบ Node.js และเปิดพอร์ต WebSocket ให้อัตโนมัติ

---

### ทางเลือกที่ 2: ถ้าต้องการใช้ Vercel จริงๆ (แยก Frontend บน Vercel + Backend บน Render/Pusher)

#### แบบที่ 2.1: แยกโฮสต์ (ง่ายสุด)
- เอาเฉพาะโฟลเดอร์ `public` หรือตัวเว็บไป Host บน **Vercel**
- เอา `server.js` ไปรันบน **Render.com** (ฟรี)
- ใน `public/app.js` บรรทัดเชื่อมต่อ WebSocket เปลี่ยนจาก `window.location.host` เป็น URL ของเซิร์ฟเวอร์ Render:
  ```javascript
  const wsUrl = `wss://your-wheel.onrender.com/ws?room=${encodeURIComponent(currentRoom)}`;
  ```

#### แบบที่ 2.2: ใช้ Vercel + Pusher Channels (Serverless 100%)
หากต้องการให้ทุกอย่างอยู่บน Vercel โดยไม่มีเซิร์ฟเวอร์ Node.js ค้างไว้:
- สมัคร [Pusher.com](https://pusher.com) (ฟรี 200,000 ข้อความ/วัน, 100 คนดูพร้อมกัน)
- ฝั่ง Client (`wheel.js`, `app.js`) ใช้ Pusher JS SDK เพื่อ Listen event `spin_start`
- ฝั่ง Vercel Serverless Function (`/api/spin`) ใช้ Pusher Server SDK เพื่อ Trigger event ให้ทุกคนพร้อมกัน
