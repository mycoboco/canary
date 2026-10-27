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
    <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-800">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-lg p-6 shadow-sm space-y-4"
      >
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">canary</h1>
        <p className="text-sm text-gray-500 dark:text-neutral-400">This server is password protected.</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPwd(e.target.value)}
          placeholder="Password"
          autoFocus
          className="w-full border border-gray-200 dark:border-neutral-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-500/40"
        />
        {invalid && <div className="text-red-500 dark:text-red-400 text-sm">Invalid password</div>}
        <button
          type="submit"
          className="w-full px-4 py-2 bg-gray-800 dark:bg-neutral-700 text-white rounded text-sm hover:bg-gray-700 dark:hover:bg-neutral-600 disabled:opacity-50"
          disabled={!password}
        >Sign in</button>
      </form>
    </div>
  );
}
