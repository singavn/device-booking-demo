import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

function App() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [formData, setFormData] = useState({ start: '', end: '', reason: '' });
  const [showConfirmModal, setShowConfirmModal] = useState(null);

  useEffect(() => {
    fetch('http://localhost:5000/api/devices')
      .then(res => res.json())
      .then(setDevices);
    fetch('http://localhost:5000/api/bookings')
      .then(res => res.json())
      .then(setBookings);
  }, []);

  const handleDateClick = (arg) => {
    const start = arg.dateStr;
    const end = new Date(new Date(start).getTime() + 60*60*1000).toISOString();
    setFormData({ start, end, reason: '' });
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
    const url = editingBooking
      ? `http://localhost:5000/api/bookings/${editingBooking.id}`
      : 'http://localhost:5000/api/bookings';
    const method = editingBooking ? 'PUT' : 'POST';

    const body = JSON.stringify({
      userId: 1,
      deviceId: selectedDevice.id,
      start: formData.start,
      end: formData.end,
      reason: formData.reason
    });

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
      alert(editingBooking ? "✅ Sửa thành công!" : "✅ Đặt thành công!");
    } else {
      alert("❌ Lỗi: " + result.error);
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
              <p><strong>Từ:</strong> {new Date(formData.start).toLocaleString()}</p>
              <p><strong>Đến:</strong> {new Date(formData.end).toLocaleString()}</p>
              <label>
                Lý do:<br/>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={e => setFormData({ ...formData, reason: e.target.value })}
                  style={{ width: '100%', padding: '8px' }}
                />
              </label>
              <div style={{ marginTop: '20px' }}>
                <button type="button" onClick={() => setShowForm(false)}>Huỷ</button>
                <button type="submit">Xác nhận</button>
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
