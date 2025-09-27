import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Login from './Login';

function App() {
  const [user, setUser] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [formData, setFormData] = useState({ start: '', end: '', reason: 'Đặt chỗ' });
  const [showConfirmModal, setShowConfirmModal] = useState(null);
  const [usersList, setUsersList] = useState([]);

  const fetchBooking = () => {
    fetch('http://localhost:3000/api/bookings')
      .then(res => res.json())
      .then(setBookings);
  }

  useEffect(() => {
    fetch('http://localhost:3000/api/devices')
      .then(res => res.json())
      .then(setDevices);
    fetchBooking()
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    }
    if (user?.role === 'admin') {
      fetch('http://localhost:3000/api/users', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
        .then(res => res.json())
        .then(data => setUsersList(data));
    }
  }, []);

  const handleLogin = async (userData) => {
    console.log('User nhận từ backend:', userData);

    const res = await fetch("http://localhost:3000/api/login", {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        "email": userData.name,
        "passWord": userData.password
      })
    });
    if (res.status == 200) {
      setUser(userData);
      localStorage.setItem('token', userData.token);
      localStorage.setItem('user', JSON.stringify(userData));
    }


  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const [formInputs, setFormInputs] = useState({
    startText: '',
    endText: '',
    reason: ''
  });

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }


  const handleDateClick = (arg) => {
    if (!selectedDevice) {
      alert("Vui lòng chọn thiết bị trước!");
      return;
    }

    const start = arg.dateStr;
    const end = new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString();

    // Chuyển ISO → dd-MM-yyyy HH:mm
    const formatDate = (isoString) => {
      const date = new Date(isoString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day}-${month}-${year} ${hours}:${minutes}`;
    };

    setFormData({ start, end }); // Lưu dạng ISO để gửi API
    setFormInputs({
      startText: formatDate(start),
      endText: formatDate(end),
      reason: 'Đặt chỗ'
    });
    setEditingBooking(null);
    setShowForm(true);
  };

  const handleEventClick = (info) => {
    const bookingId = parseInt(info.event.id);
    const booking = bookings.find(b => b.id === bookingId);

    const device = devices.find(d => d.id === booking?.deviceId);
    if (!booking || !device) return;
    console.log(info.event._def.extendedProps.userName);

    setShowConfirmModal({ booking, device, start: info.event.startStr, end: info.event.endStr, userName: info.event._def.extendedProps.userName });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedDevice) {
      alert("❌ Vui lòng chọn thiết bị.");
      return;
    }

    // ✅ Dùng formInputs.reason, không phải formData.reason
    const { startText, endText, reason } = formInputs;

    // Chuyển từ dd-MM-yyyy HH:mm → ISO
    const parseDateTime = (text) => {
      const match = text.match(/(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})/);
      if (!match) return null;
      const [, day, month, year, hours, minutes] = match;
      const date = new Date(year, month - 1, day, hours, minutes);
      return isNaN(date.getTime()) ? null : date.toISOString();
    };

    const start = parseDateTime(startText);
    const end = parseDateTime(endText);

    if (!start || !end) {
      alert("❌ Vui lòng chọn đầy đủ thời gian.");
      return;
    }

    if (new Date(end) <= new Date(start)) {
      alert("❌ Thời gian kết thúc phải sau thời gian bắt đầu.");
      return;
    }

    const durationInHours = (new Date(end) - new Date(start)) / (1000 * 60 * 60);
    const maxDuration = 5;
    if (durationInHours > maxDuration) {
      alert(`⏰ Không được đặt quá ${maxDuration} tiếng.`);
      return;
    }

    const url = editingBooking
      ? `http://localhost:3000/api/bookings/${editingBooking.id}`
      : 'http://localhost:3000/api/bookings';
    const method = editingBooking ? 'PUT' : 'POST';

    const token = localStorage.getItem('token');

    const body = JSON.stringify({
      userId: 1,
      deviceId: selectedDevice.id,
      start,
      end,
      reason // ✅ Dùng từ formInputs
    });

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body
      });
      const result = await res.json();

      if (res.ok) {
        if (editingBooking) {
          setBookings(bookings.map(b => b.id === editingBooking.id ? result : b));
        } else {
          setBookings([...bookings, result]);
        }
        setShowForm(false);
        alert(editingBooking ? "✅ Sửa thành công!" : "✅ Đặt lịch thành công!");
      } else {
        alert("❌ Lỗi: " + result.error);
      }
    } catch (err) {
      console.error("Lỗi kết nối:", err); // Log chi tiết
      alert("❌ Kết nối thất bại: Không thể kết nối đến server.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Xác nhận xoá?")) return;
    console.log(user);

    const res = await fetch(`http://localhost:3000/api/bookings/${id}`, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        "userName": user.name
      })
    }).then((data) => {
      fetchBooking()
    });

    alert("✅ Đã xoá!");
  };

  const eventList = bookings.map(b => {
    const device = devices.find(d => d.id === b.deviceId);
    return {
      id: b.id,
      title: `${device?.name} - ${b.userName}` || 'Thiết bị',
      userName: b.userName,
      start: b.start,
      end: b.end,
      backgroundColor: '#0078D4',
      borderColor: '#0078D4',
      textColor: 'white'
    };
  });

  return (
    <div style={{ fontFamily: 'Segoe UI, Arial, sans-serif' }}>
      {/* Header */}
      <header style={{
        padding: '15px 20px',
        backgroundColor: '#0078D4',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1>🛠️ Device Booking Tool</h1>
        <div>
          <span>Chào, {user.name}</span>
          <button
            onClick={handleLogout}
            style={{
              marginLeft: '15px',
              padding: '6px 12px',
              backgroundColor: '#f3f3f3',
              color: '#333',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Đăng xuất
          </button>
        </div>
      </header>

      {user.role === 'admin' && (
        <div style={{ padding: '20px', marginTop: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
          <h2>🛠️ Quản trị viên</h2>

          {/* Quản lý thiết bị */}
          <div>
            <h3>Quản lý Thiết bị</h3>
            <button onClick={() => alert("Tính năng thêm thiết bị đang phát triển")}>
              Thêm thiết bị mới
            </button>
            <ul>
              {devices.map(d => (
                <li key={d.id}>
                  {d.name} - {d.status}
                  <button style={{ marginLeft: '10px' }} onClick={() => alert(`Sửa ${d.name}`)}>Sửa</button>
                  <button style={{ marginLeft: '5px', color: 'red' }} onClick={() => alert(`Xoá ${d.name}`)}>Xoá</button>
                </li>
              ))}
            </ul>
          </div>

          {/* Quản lý người dùng */}
          <div style={{ marginTop: '30px' }}>
            <h3>Quản lý Người dùng</h3>
            <button onClick={() => alert("Tính năng thêm người dùng đang phát triển")}>
              Tạo người dùng mới
            </button>
            <ul>
              {usersList.map(u => (
                <li key={u.id}>
                  {u.name} ({u.email}) - {u.role}
                  <button style={{ marginLeft: '10px' }} onClick={() => alert(`Sửa ${u.email}`)}>Sửa</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div style={{ padding: '20px', fontFamily: 'Segoe UI, Arial' }}>
        <h1>🛠️ Booking Tool - Server Schedule</h1>

        <div style={{ marginBottom: '20px' }}>
          {devices.map(d => (
            <button
              key={d.id}
              onClick={() => setSelectedDevice(d)}
              style={{
                margin: '5px',
                padding: '10px',
                border: selectedDevice?.id === d.id ? '3px solid #0078D4' : '1px solid #ccc',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              {d.name}
            </button>
          ))}
        </div>

        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar="prev,next today, title, dayGridMonth,timeGridWeek,timeGridDay"
          events={eventList}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          editable={false}
          selectable
          nowIndicator
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          height="auto"
        />

        {/* Modal đặt/sửa */}
        {showForm && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center',
            alignItems: 'center', zIndex: 10000
          }}>
            <div style={{
              background: 'white', padding: '30px', borderRadius: '10px',
              width: '90%', maxWidth: '500px'
            }}>
              <h3>{editingBooking ? 'Sửa lịch' : 'Đặt lịch mới'}</h3>
              <form onSubmit={handleSubmit}>
                <p><strong>Thiết bị:</strong> {selectedDevice?.name}</p>
                <label>
                  Thời gian bắt đầu:<br />
                  <DatePicker
                    selected={new Date(formData.start)}
                    onChange={(date) =>
                      setFormData({
                        ...formData,
                        start: date.toISOString().slice(0, 16),
                      })
                    }
                    showTimeSelect
                    timeFormat="HH:mm"
                    timeIntervals={15}
                    timeCaption="Giờ"
                    dateFormat="dd/MM/yyyy HH:mm"
                    customInput={<input style={{ padding: '8px', width: '180px' }} />}
                    required
                  />
                  <br /><br />
                </label>

                <label style={{ marginLeft: '0px' }}>
                  Thời gian kết thúc:<br />
                  <DatePicker
                    selected={new Date(formData.end)}
                    onChange={(date) =>
                      setFormData({
                        ...formData,
                        end: date.toISOString().slice(0, 16),
                      })
                    }
                    showTimeSelect
                    timeFormat="HH:mm"
                    timeIntervals={15}
                    timeCaption="Giờ"
                    dateFormat="dd/MM/yyyy HH:mm"
                    customInput={<input style={{ padding: '8px', width: '180px' }} />}
                    required
                  />
                </label>
                <label style={{ display: 'block', marginTop: '10px' }}>
                  Lý do sử dụng:<br />
                  <input
                    type="text"
                    value={formData.reason}
                    onChange={e => setFormData({ ...formData, reason: e.target.value })}
                    style={{ width: '100%', padding: '8px' }}
                  />
                </label>
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',  // ← Căn giữa theo chiều ngang
                  alignItems: 'center',     // ← Căn giữa theo chiều dọc (nếu cần)
                  gap: '15px',
                  marginTop: '25px'
                }}>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#f3f3f3',
                      color: '#333',
                      border: '1px solid #ccc',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '500',
                      fontSize: '14px',
                      minWidth: '80px'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#e0e0e0'}
                    onMouseOut={(e) => e.target.style.backgroundColor = '#f3f3f3'}
                  >
                    Huỷ
                  </button>

                  <button
                    type="submit"
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#0078D4',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px',
                      minWidth: '80px'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#005a9e'}
                    onMouseOut={(e) => e.target.style.backgroundColor = '#0078D4'}
                  >
                    Xác nhận
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal xác nhận Sửa/Xoá */}
        {showConfirmModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center',
            alignItems: 'center', zIndex: 10000
          }}>
            <div style={{
              background: 'white', padding: '30px', borderRadius: '10px',
              width: '90%', maxWidth: '500px', textAlign: 'center'
            }}>
              <h3>📋 {showConfirmModal.device.name}</h3>
              <p>{new Date(showConfirmModal.start).toLocaleString()} → {new Date(showConfirmModal.end).toLocaleString()}</p>
              <p><strong>Lý do:</strong>{showConfirmModal.userName} {showConfirmModal.booking.reason || 'Không có'}</p>
              <div style={{ marginTop: '20px' }}>
                <button
                  style={{ marginRight: '10px', backgroundColor: '#0078D4', color: 'white', border: 'none', padding: '10px 20px' }}
                  onClick={() => {
                    setSelectedDevice(showConfirmModal.device);
                    setFormData({
                      start: showConfirmModal.start,
                      end: showConfirmModal.end,
                      reason: showConfirmModal.booking.reason || ''
                    });
                    setEditingBooking(showConfirmModal.booking);
                    setShowForm(true);
                    setShowConfirmModal(null);
                  }}
                >
                  ✏️ Sửa
                </button>
                <button
                  style={{ backgroundColor: '#D83B01', color: 'white', border: 'none', padding: '10px 20px' }}
                  onClick={() => {
                    handleDelete(showConfirmModal.booking.id);
                    setShowConfirmModal(null);
                  }}
                >
                  🗑️ Xoá
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
