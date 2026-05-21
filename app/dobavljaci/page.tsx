'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabaseUrl = 'https://cqwiblmohdjehbeifnko.supabase.co';
const supabaseKey = 'sb_publishable_S8mQrQ5iL8F1ZmO1zjqQfg_ePTqKSZf';

const supabase = createClient(supabaseUrl, supabaseKey);

type Supplier = {
  id: string;
  name: string;
  type: string;
  phone: string | null;
  address: string | null;
  pib: string | null;
  mb: string | null;
  jmbg: string | null;
  br_lk: string | null;
  note: string | null;
  created_at: string;
};

export default function DobavljaciPage() {
  const router = useRouter();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState('firma');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [pib, setPib] = useState('');
  const [mb, setMb] = useState('');
  const [jmbg, setJmbg] = useState('');
  const [brLk, setBrLk] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');

  async function checkUserAndLoad() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    await loadSuppliers();
    setLoading(false);
  }

  async function loadSuppliers() {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSuppliers(data as Supplier[]);
    }
  }

  async function addSupplier(e: any) {
    e.preventDefault();

    setSaving(true);
    setMessage('');

    const { error } = await supabase.from('suppliers').insert({
      name: name,
      type: type,
      phone: phone,
      address: address,
      pib: type === 'firma' ? pib : '',
      mb: type === 'firma' ? mb : '',
      jmbg: type === 'fizicko_lice' ? jmbg : '',
      br_lk: type === 'fizicko_lice' ? brLk : '',
      note: note,
    });

    setSaving(false);

    if (error) {
      setMessage('Greška: dobavljač nije sačuvan.');
      return;
    }

    setName('');
    setType('firma');
    setPhone('');
    setAddress('');
    setPib('');
    setMb('');
    setJmbg('');
    setBrLk('');
    setNote('');
    setMessage('Dobavljač je uspešno dodat.');

    await loadSuppliers();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  useEffect(() => {
    checkUserAndLoad();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p>Učitavanje...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="bg-green-900 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Euro Trade Plus</h1>
          <p className="text-sm text-green-100">Dobavljači</p>
        </div>

        <button
          onClick={logout}
          className="bg-white text-green-900 px-4 py-2 rounded-xl font-semibold"
        >
          Odjava
        </button>
      </header>

      <nav className="bg-white border-b px-6 py-4 flex flex-wrap gap-3">
        <Link className="bg-gray-100 px-4 py-2 rounded-xl" href="/dashboard">
          Dashboard
        </Link>

        <Link className="bg-gray-100 px-4 py-2 rounded-xl" href="/otkup">
          Novi otkup
        </Link>

        <Link className="bg-gray-100 px-4 py-2 rounded-xl" href="/prodaja">
          Nova prodaja
        </Link>

        <Link className="bg-green-800 text-white px-4 py-2 rounded-xl" href="/dobavljaci">
          Dobavljači
        </Link>

        <Link className="bg-gray-100 px-4 py-2 rounded-xl" href="/kupci">
          Kupci
        </Link>

        <Link className="bg-gray-100 px-4 py-2 rounded-xl" href="/lista-otkupa">
          Lista otkupa
        </Link>

        <Link className="bg-gray-100 px-4 py-2 rounded-xl" href="/lista-prodaje">
          Lista prodaje
        </Link>
      </nav>

      <section className="p-6 grid lg:grid-cols-2 gap-6">
        <form onSubmit={addSupplier} className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-2xl font-bold text-green-800">
            Dodaj dobavljača
          </h2>

          <div className="mt-5">
            <label className="block text-sm font-medium text-gray-700">
              Naziv / ime i prezime dobavljača
            </label>
            <input
              className="mt-1 w-full border rounded-xl px-4 py-3"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">
              Tip
            </label>
            <select
              className="mt-1 w-full border rounded-xl px-4 py-3"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="firma">Firma</option>
              <option value="fizicko_lice">Fizičko lice</option>
            </select>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">
              Telefon
            </label>
            <input
              className="mt-1 w-full border rounded-xl px-4 py-3"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">
              Adresa
            </label>
            <input
              className="mt-1 w-full border rounded-xl px-4 py-3"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          {type === 'firma' ? (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">
                  PIB
                </label>
                <input
                  className="mt-1 w-full border rounded-xl px-4 py-3"
                  value={pib}
                  onChange={(e) => setPib(e.target.value)}
                />
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">
                  MB
                </label>
                <input
                  className="mt-1 w-full border rounded-xl px-4 py-3"
                  value={mb}
                  onChange={(e) => setMb(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">
                  JMBG
                </label>
                <input
                  className="mt-1 w-full border rounded-xl px-4 py-3"
                  value={jmbg}
                  onChange={(e) => setJmbg(e.target.value)}
                />
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">
                  BR LK
                </label>
                <input
                  className="mt-1 w-full border rounded-xl px-4 py-3"
                  value={brLk}
                  onChange={(e) => setBrLk(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">
              Napomena
            </label>
            <textarea
              className="mt-1 w-full border rounded-xl px-4 py-3"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {message ? (
            <div className="mt-4 bg-green-50 text-green-800 px-4 py-3 rounded-xl text-sm">
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="mt-6 w-full bg-green-800 text-white rounded-xl py-3 font-semibold hover:bg-green-900 disabled:opacity-60"
          >
            {saving ? 'Čuvanje...' : 'Sačuvaj dobavljača'}
          </button>
        </form>

        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-2xl font-bold text-green-800">
            Lista dobavljača
          </h2>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-3">Naziv</th>
                  <th className="p-3">Tip</th>
                  <th className="p-3">Telefon</th>
                  <th className="p-3">Adresa</th>
                  <th className="p-3">PIB</th>
                  <th className="p-3">MB</th>
                  <th className="p-3">JMBG</th>
                  <th className="p-3">BR LK</th>
                  <th className="p-3">Napomena</th>
                </tr>
              </thead>

              <tbody>
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="border-b">
                    <td className="p-3 font-medium">{supplier.name}</td>
                    <td className="p-3">
                      {supplier.type === 'firma' ? 'Firma' : 'Fizičko lice'}
                    </td>
                    <td className="p-3">{supplier.phone || '-'}</td>
                    <td className="p-3">{supplier.address || '-'}</td>
                    <td className="p-3">{supplier.pib || '-'}</td>
                    <td className="p-3">{supplier.mb || '-'}</td>
                    <td className="p-3">{supplier.jmbg || '-'}</td>
                    <td className="p-3">{supplier.br_lk || '-'}</td>
                    <td className="p-3">{supplier.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {suppliers.length === 0 ? (
              <p className="text-gray-500 mt-4">
                Još nema unetih dobavljača.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}