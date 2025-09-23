// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const AWS = require('aws-sdk');

const app = express();
app.use(cors());
app.use(express.json());

// Cấu hình kết nối R2 (S3 API)
const s3 = new AWS.S3({
  endpoint: process.env.R2_ENDPOINT,
  accessKeyId: process.env.R2_ACCESS_KEY,
  secretAccessKey: process.env.R2_SECRET_KEY,
  signatureVersion: 'v4',
});

const BUCKET = process.env.R2_BUCKET_NAME;
const DEVICE_FILE = 'devices.json';
const BOOKING_FILE = 'bookings.json';

// Đọc file từ R2
async function readFromS3(filename) {
  try {
    const data = await s3.getObject({ Bucket: BUCKET, Key: filename }).promise();
    return JSON.parse(data.Body.toString());
  } catch (err) {
    if (err.code === 'NoSuchKey') {
      // Tạo 7 Server nếu chưa có
      if (filename === DEVICE_FILE) {
        return Array.from({ length: 7 }, (_, i) => ({
          id: i + 1,
          name: `Server ${i + 1}`,
          status: 'available',
          location: 'Data Center A',
          max_duration: 180
        }));
      }
      return [];
    }
    throw err;
  }
}

// Ghi file lên R2
async function writeToS3(filename, data) {
  await s3.putObject({
    Bucket: BUCKET,
    Key: filename,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json',
  }).promise();
}

// === API ===
app.get('/api/devices', async (req, res) => {
  try {
    res.json(await readFromS3(DEVICE_FILE));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bookings', async (req, res) => {
  try {
    res.json(await readFromS3(BOOKING_FILE));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bookings', async (req, res) => {
  const { userId, deviceId, start, end, reason } = req.body;
  try {
    const devices = await readFromS3(DEVICE_FILE);
    const bookings = await readFromS3(BOOKING_FILE);

    const device = devices.find(d => d.id === deviceId);
    if (!device || device.status !== 'available') {
      return res.status(400).json({ error: 'Thiết bị không khả dụng.' });
    }

    const conflict = bookings.some(b =>
      b.deviceId === deviceId && !(end <= b.start || start >= b.end)
    );
    if (conflict) {
      return res.status(400).json({ error: 'Trùng thời gian.' });
    }

    const newBooking = {
      id: bookings.length + 1,
      userId,
      deviceId,
      start,
      end,
      reason,
      status: 'confirmed',
      createdAt: new Date().toISOString()
    };

    bookings.push(newBooking);
    await writeToS3(BOOKING_FILE, bookings);
    res.status(201).json(newBooking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/bookings/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { start, end, reason } = req.body;

  try {
    const devices = await readFromS3(DEVICE_FILE);
    const bookings = await readFromS3(BOOKING_FILE);
    const booking = bookings.find(b => b.id === id);
    if (!booking) return res.status(404).json({ error: 'Không tìm thấy.' });

    const deviceId = booking.deviceId;
    const device = devices.find(d => d.id === deviceId);
    if (!device || device.status !== 'available') {
      return res.status(400).json({ error: 'Thiết bị không khả dụng.' });
    }

    const conflict = bookings.some(b =>
      b.id !== id && b.deviceId === deviceId && !(end <= b.start || start >= b.end)
    );
    if (conflict) return res.status(400).json({ error: 'Trùng thời gian.' });

    Object.assign(booking, { start, end, reason });
    await writeToS3(BOOKING_FILE, bookings);
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/bookings/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const bookings = await readFromS3(BOOKING_FILE);
    const filtered = bookings.filter(b => b.id !== id);
    if (bookings.length === filtered.length) {
      return res.status(404).json({ error: 'Không tìm thấy.' });
    }
    await writeToS3(BOOKING_FILE, filtered);
    res.json({ message: 'Xoá thành công!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Backend: http://localhost:${PORT}`);
});
