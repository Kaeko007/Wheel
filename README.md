# Real-time Synchronized Lucky Wheel (SyncWheel)

เว็บสุ่มวงล้อแบบแสดงผลพร้อมกันทุกคนแบบ Real-Time ผ่าน WebSocket รองรับคนดูหลายคนพร้อมกัน ทุกคนจะเห็นวงล้อหมุน ชะลอความเร็ว และหยุดที่ผลเดียวกันวินาทีต่อวินาที

## คุณสมบัติเด่น
- **Real-Time Synchronized Physics**: คำนวณองศาการหมุนและการลดความเร็วสัมพันธ์กับ Server Clock Sync ทำให้ทุกหน้าจอกระตุกหยุดตรงช่องเดียวกันแบบ 100%
- **Live Viewer Badge**: แสดงจำนวนผู้ชมที่กำลังเปิดดูหน้าเว็บสด ณ ขณะนั้นทันที
- **Room System (`?room=name`)**: แยกห้องสุ่มได้อิสระเพียงแค่เปลี่ยนชื่อห้องหรือแชร์ลิงก์
- **Web Audio FX (Zero External Files)**: เสียงติ๊กเข็มกระทบช่องตามความเร็วจริง และเสียงดนตรีเฉลิมฉลองเมื่อได้ผู้ชนะ
- **Fullscreen Confetti Cannon**: พลุกระดาษเฉลิมฉลองเมื่อหมุนเสร็จ
- **Item Management**: เพิ่ม, ลบ, สลับรายการ (Shuffle), วางหลายบรรทัดพร้อมกัน (Bulk Add), และปุ่มลบผู้ชนะออกจากวงล้อหลังหมุน
- **History Log**: บันทึกประวัติผู้ชนะในรอบที่ผ่านมา

## วิธีเริ่มใช้งาน

1. เปิด Terminal / PowerShell ที่โฟลเดอร์นี้:
   ```bash
   cd "C:\Users\devtu\.gemini\antigravity\scratch\realtime-wheel"
   ```

2. รันเซิร์ฟเวอร์:
   ```bash
   node server.js
   ```

3. เปิดเบราว์เซอร์:
   - เครื่องของตัวเอง: [http://localhost:3000](http://localhost:3000)
   - ชวนเพื่อนในวง Wi-Fi / วงแลนเดียวกัน: `http://<IP-เครื่องคุณ>:3000`
   - สามารถสร้างห้องแยกได้ เช่น `http://localhost:3000/?room=party`
