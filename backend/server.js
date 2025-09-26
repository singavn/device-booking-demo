
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const AWS = require('aws-sdk');
const { verifyToken, isAdmin } = require('./auth');

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
      if (filename === 'bookings.json') {
        return [];
      }

      if (filename === 'users.json') {
        // ✅ Tự tạo user admin + user mặc định
        const hashedAdmin = '$2b$10$7KzXk6Zv5Y8wW3a4q6r9.eNpV7QnR2uJ1xLmO0sP5yQcGhF1aB2C'; // hash của 'admin123'
        const hashedUser = '$2b$10$9X8yZ5A1bC3dE4fG6hI7jKlMnOpQrStUvWxYzAbCdEfGhIjKlMnOp'; // hash của 'user123'

        const defaultUsers = [
          {
            id: 1,
            email: 'admin@demo.com',
            password: hashedAdmin,
            name: 'Admin',
            role: 'admin'
          },
          {
            id: 2,
            email: 'user@demo.com',
            password: hashedUser,
            name: 'User1',
            role: 'user'
          }
        ];
        await writeToS3('users.json', defaultUsers);
        return defaultUsers;
      }
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
// ✅ Tạo thiết bị mới (chỉ admin)
app.post('/api/devices', verifyToken, isAdmin, async (req, res) => {
  const { name, location, status = 'available', max_duration = 180 } = req.body;
  try {
    const devices = await readFromS3('devices.json');
    const newDevice = {
      id: devices.length + 1,
      name,
      location,
      status,
      max_duration
    };
    devices.push(newDevice);
    await writeToS3('devices.json', devices);
    res.status(201).json(newDevice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Sửa thiết bị (chỉ admin)
app.put('/api/devices/:id', verifyToken, isAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const updates = req.body;

  try {
    const devices = await readFromS3('devices.json');
    const device = devices.find(d => d.id === id);
    if (!device) return res.status(404).json({ error: 'Không tìm thấy thiết bị.' });

    Object.assign(device, updates);
    await writeToS3('devices.json', devices);
    res.json(device);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Xoá thiết bị (chỉ admin)
app.delete('/api/devices/:id', verifyToken, isAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const devices = await readFromS3('devices.json');
    const filtered = devices.filter(d => d.id !== id);
    if (devices.length === filtered.length) {
      return res.status(404).json({ error: 'Không tìm thấy thiết bị.' });
    }
    await writeToS3('devices.json', filtered);
    res.json({ message: 'Xoá thành công!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

// API: login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const users = await readFromS3('users.json');
    const user = users.find(u => u.email === email);

    if (!user) {
      return res.status(400).json({ error: 'Email hoặc mật khẩu sai.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Email hoặc mật khẩu sai.' });
    }

    const token = generateToken(user);
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//API: create user
app.post('/api/users', verifyToken, isAdmin, async (req, res) => {
  const { email, password, name, role = 'user' } = req.body;

  try {
    const users = await readFromS3('users.json');
    const safeUsers = users.map(({ password, ...rest }) => rest);
    res.json(safeUsers);
    if (users.some(u => u.email === email)) {
      return res.status(400).json({ error: 'Email đã tồn tại.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: users.length + 1,
      email,
      password: hashedPassword,
      name,
      role
    };

    users.push(newUser);
    await writeToS3('users.json', users);

    res.status(201).json({ id: newUser.id, email, name, role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});