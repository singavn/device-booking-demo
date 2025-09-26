import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

function App() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [formData, setFormData] = useState({ start: '', end: '', reason: 'Đặt chỗ' });
  const [showConfirmModal, setShowConfirmModal] = useState(null);

  useEffect(() => {
    fetch('http://localhost:5000/api/devices')
      .then(res => res.json())
      .then(setDevices);
    fetch('http://localhost:5000/api/bookings')
      .then(res => res.json())
      .then(setBookings);
  }, []);
  
  const [formInputs, setFormInputs] = useState({
    startText: '',
    endText: '',
    reason: ''
  });

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

    setShowConfirmModal({ booking, device, start: info.event.startStr, end: info.event.endStr });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Kiểm tra selectedDevice tồn tại
    if (!selectedDevice) {
      alert("❌ Vui lòng chọn thiết bị.");
      return;
    }
  const {reason } = formData;
    // Hàm chuyển "dd-MM-yyyy HH:mm" → ISO string
  const parseDateTime = (text) => {
    const match = text.match(/(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})/);
    if (!match) return null;
    const [, day, month, year, hours, minutes] = match;
    // Tháng trong JS từ 0-11 → trừ 1
    const date = new Date(year, month - 1, day, hours, minutes);
    return isNaN(date.getTime()) ? null : date.toISOString();
  };

  const start = parseDateTime(formInputs.startText);
  const end = parseDateTime(formInputs.endText);
  
    if (!start || !end) {
      alert("❌ Vui lòng chọn đầy đủ thời gian.");
      return;
    }
  
    if (new Date(end) <= new Date(start)) {
      alert("❌ Thời gian kết thúc phải sau thời gian bắt đầu.");
      return;
    }
  
    // Tính duration (phòng trường hợp cần kiểm tra giới hạn)
    const durationInHours = (new Date(end) - new Date(start)) / (1000 * 60 * 60);
    const maxDuration = 5; // tối đa 24 tiếng
    if (durationInHours > maxDuration) {
      alert(`⏰ Không được đặt quá ${maxDuration} tiếng.`);
      return;
    }
  
    const url = editingBooking
      ? `http://localhost:5000/api/bookings/${editingBooking.id}`
      : 'http://localhost:5000/api/bookings';
    const method = editingBooking ? 'PUT' : 'POST';
  
    const body = JSON.stringify({
      userId: 1,
      deviceId: selectedDevice.id,
      start,
      end,
      reason
    });
  
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
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
      alert("❌ Kết nối thất bại: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Xác nhận xoá?")) return;
    await fetch(`http://localhost:5000/api/bookings/${id}`, { method: 'DELETE' });
    setBookings(bookings.filter(b => b.id !== id));
    alert("✅ Đã xoá!");
  };

  const eventList = bookings.map(b => {
    const device = devices.find(d => d.id === b.deviceId);
    return {
      id: b.id,
      title: device?.name || 'Thiết bị',
      start: b.start,
      end: b.end,
      backgroundColor: '#0078D4',
      borderColor: '#0078D4',
      textColor: 'white'
    };
  });

  return (
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
    Thời gian bắt đầu:<br/>
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
  <br/><br/>
  </label>

  <label style={{ marginLeft: '0px' }}>
    Thời gian kết thúc:<br/>
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
              Lý do sử dụng:<br/>
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
            <p><strong>Lý do:</strong> {showConfirmModal.booking.reason || 'Không có'}</p>
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
  );
}

export default App;
