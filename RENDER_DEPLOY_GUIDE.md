# คู่มือเอาขึ้น Render.com (ฟรี & ใช้ได้ตลอด 24 ชม.)

โปรเจกต์นี้เซ็ตอัพไฟล์ `render.yaml` และ `.gitignore` พร้อมคำสั่ง Git ไว้ครบแล้ว สามารถทำตาม 3 ขั้นตอนนี้ได้เลย:

---

## ขั้นตอนที่ 1: สร้าง Repository บน GitHub
1. เข้าเว็บ [github.com](https://github.com/) แล้วล็อกอิน
2. กดปุ่ม **New** (สร้าง Repo ใหม่)
3. ตั้งชื่อ Repository เช่น `realtime-wheel`
4. เลือกเป็น **Public** หรือ **Private** ก็ได้ แล้วกด **Create repository**

---

## ขั้นตอนที่ 2: Push โค้ดขึ้น GitHub
เปิด PowerShell ในเครื่อง แล้วรันคำสั่ง 3 บรรทัดนี้ (เปลี่ยน `<username>` เป็นชื่อ GitHub ของคุณ):

```powershell
cd "C:\Users\devtu\.gemini\antigravity\scratch\realtime-wheel"
git branch -M main
git remote add origin https://github.com/<username>/realtime-wheel.git
git push -u origin main
```

---

## ขั้นตอนที่ 3: กด Deploy บน Render.com
1. เข้าเว็บ [render.com](https://render.com/) และล็อกอิน (ล็อกอินด้วยบัญชี GitHub จะสะดวกที่สุด)
2. กดปุ่มสีน้ำเงิน **"New +"** ด้านขวาบน -> เลือก **"Web Service"**
3. เลือก **"Build and deploy from a Git repository"**
4. เลือกรีโป `realtime-wheel` ที่เพิ่ง Push ไป
5. หน้าตั้งค่า Render จะตรวจพบไฟล์คอนฟิกให้อัตโนมัติ:
   - **Name:** `realtime-wheel`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** `Free`
6. เลื่อนลงมาล่างสุด กดปุ่ม **"Deploy Web Service"**

---

## เสร็จสิ้น! 🎉
- รอประมาณ 1-2 นาที Render จะ Build เสร็จแล้วให้ URL มา เช่น:
  `https://realtime-wheel-xxxx.onrender.com`
- ส่งลิงก์นี้ให้เพื่อน ทุกคนเปิดดูพร้อมกัน วงล้อจะหมุน ซิงค์เวลา และแสดงจำนวนคนดูสดแบบ Real-Time อัตโนมัติทันที
- **แถม:** สร้างห้องแยกได้ด้วยการต่อท้าย URL เช่น `https://realtime-wheel-xxxx.onrender.com/?room=friend1`
