import {useState} from 'react';
import {setPassword} from '../api.js';

export default function Login({invalid, onLogin}) {
  const [password, setPwd] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!password) return;
    setPassword(password);
    onLogin();
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-4"
      >
        <h1 className="text-xl font-bold text-gray-800">canary</h1>
        <p className="text-sm text-gray-500">This server is password protected.</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPwd(e.target.value)}
          placeholder="Password"
          autoFocus
          className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        {invalid && <div className="text-red-500 text-sm">Invalid password</div>}
        <button
          type="submit"
          className="w-full px-4 py-2 bg-gray-800 text-white rounded text-sm hover:bg-gray-700 disabled:opacity-50"
          disabled={!password}
        >Sign in</button>
      </form>
    </div>
  );
}
