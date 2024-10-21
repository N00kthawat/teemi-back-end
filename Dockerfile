# ใช้ภาพพื้นฐานจาก Node.js
FROM node:18-alpine

# ตั้งค่าการทำงาน
WORKDIR /app

# คัดลอกไฟล์ package.json และ package-lock.json
COPY package*.json ./

# ติดตั้ง dependencies
RUN npm install --legacy-peer-deps

# คัดลอกไฟล์อื่น ๆ ไปยัง container
COPY . .

# สร้าง bcrypt จากแหล่งที่มา
RUN npm rebuild bcrypt --build-from-source

# เปิดพอร์ตที่แอปพลิเคชันจะฟัง
EXPOSE 5000

# คำสั่งเริ่มต้นสำหรับ container
CMD ["npm", "start"]
