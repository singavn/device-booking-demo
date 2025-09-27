import React, { useState } from 'react';

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Giả lập đăng nhập thành công
    onLogin({ name: email, password });
  };

  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h2>🔐 Đăng nhập</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: '8px', margin: '10px 0', width: '200px' }}
        />
        <br />
        <input
          type="password"
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: '8px', margin: '10px 0', width: '200px' }}
        />
        <br />
        <button type="submit" style={{ marginTop: '10px', padding: '8px 16px' }}>
          Đăng nhập
        </button>
      </form>
    </div>
  );
}

export default Login;