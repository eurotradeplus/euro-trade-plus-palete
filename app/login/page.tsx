'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabaseUrl = 'https://cqwiblmohdjehbeifnko.supabase.co';
const supabaseKey = 'sb_publishable_S8mQrQ5iL8F1ZmO1zjqQfg_ePTqKSZf';

const supabase = createClient(supabaseUrl, supabaseKey);

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('admin@eurotradeplus.rs');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setErrorMessage('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      setLoading(false);
      setErrorMessage('Unesi email.');
      return;
    }

    if (!cleanPassword) {
      setLoading(false);
      setErrorMessage('Unesi lozinku.');
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword,
    });

    setLoading(false);

    if (error) {
      setErrorMessage('Pogrešan email ili lozinka.');
      return;
    }

    if (!data.session || !data.user) {
      setErrorMessage('Login nije uspeo. Probaj ponovo.');
      return;
    }

    router.push('/dashboard');
  }

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <form
        onSubmit={handleLogin}
        className="bg-white p-8 rounded-2xl shadow max-w-md w-full"
      >
        <h1 className="text-3xl font-bold text-green-800 text-center">
          Euro Trade Plus
        </h1>

        <p className="text-gray-600 text-center mt-2">
          Prijava u aplikaciju
        </p>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700">
            Email
          </label>

          <input
            className="mt-1 w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-700"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            required
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">
            Lozinka
          </label>

          <input
            className="mt-1 w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-700"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        {errorMessage ? (
          <div className="mt-4 bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm">
            {errorMessage}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full bg-green-800 text-white rounded-xl py-3 font-semibold hover:bg-green-900 disabled:opacity-60"
        >
          {loading ? 'Prijava...' : 'Prijavi se'}
        </button>
      </form>
    </main>
  );
}