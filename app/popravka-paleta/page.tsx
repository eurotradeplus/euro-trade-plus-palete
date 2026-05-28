'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabaseUrl = 'https://cqwiblmohdjehbeifnko.supabase.co';
const supabaseKey = 'sb_publishable_S8mQrQ5iL8F1ZmO1zjqQfg_ePTqKSZf';

const supabase = createClient(supabaseUrl, supabaseKey);

type PalletType = {
  id: string;
  name: string;
};

type StockItem = {
  pallet_type_id: string;
  pallet_type_name: string;
  current_quantity: number;
};

type RepairItem = {
  id: string;
  damaged_pallet_type_name: string;
  target_pallet_type_name: string;
  damaged_quantity: number;
  repaired_quantity: number;
  scrap_quantity: number;
  note: string | null;
  created_by_name: string | null;
  created_by_email: string | null;
  created_at: string;
};

export default function PopravkaPaletaPage() {
  const router = useRouter();

  const [palletTypes, setPalletTypes] = useState<PalletType[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [repairs, setRepairs] = useState<RepairItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [damagedPalletTypeId, setDamagedPalletTypeId] = useState('');
  const [targetPalletTypeId, setTargetPalletTypeId] = useState('');
  const [damagedQuantity, setDamagedQuantity] = useState('');
  const [repairedQuantity, setRepairedQuantity] = useState('');
  const [note, setNote] = useState('');

  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  function normalize(value: string) {
    return value
      .toLowerCase()
      .replace(/š/g, 's')
      .replace(/đ/g, 'dj')
      .replace(/č/g, 'c')
      .replace(/ć/g, 'c')
      .replace(/ž/g, 'z');
  }

  function isDamagedPallet(name: string) {
    const n = normalize(name);

    return (
      n.includes('ostec') &&
      (
        n.includes('euro') ||
        n.includes('jednokrat')
      )
    );
  }

  function isEuroDamaged(name: string) {
    const n = normalize(name);
    return n.includes('ostec') && n.includes('euro');
  }

  function isOneWay1200x800Damaged(name: string) {
    const n = normalize(name);
    return n.includes('ostec') && n.includes('jednokrat') && n.includes('1200x800');
  }

  function isOneWay1200x1000Damaged(name: string) {
    const n = normalize(name);
    return n.includes('ostec') && n.includes('jednokrat') && n.includes('1200x1000');
  }

  function getCurrentStock(palletTypeId: string) {
    const found = stock.find((item) => item.pallet_type_id === palletTypeId);
    return found ? Number(found.current_quantity || 0) : 0;
  }

  function formatDateTime(value: string) {
    const date = new Date(value);

    return date.toLocaleString('sr-RS', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const damagedOptions = useMemo(() => {
    return palletTypes.filter((item) => isDamagedPallet(item.name));
  }, [palletTypes]);

  const selectedDamagedPallet = useMemo(() => {
    return palletTypes.find((item) => item.id === damagedPalletTypeId) || null;
  }, [palletTypes, damagedPalletTypeId]);

  const targetOptions = useMemo(() => {
    if (!selectedDamagedPallet) return [];

    const selectedName = selectedDamagedPallet.name;

    if (isEuroDamaged(selectedName)) {
      return palletTypes.filter((item) => {
        const n = normalize(item.name);

        return (
          !n.includes('ostec') &&
          n.includes('euro') &&
          (
            n.includes('klasa 1') ||
            n.includes('klasa 2')
          )
        );
      });
    }

    if (isOneWay1200x800Damaged(selectedName)) {
      return palletTypes.filter((item) => {
        const n = normalize(item.name);

        return (
          !n.includes('ostec') &&
          n.includes('jednokrat') &&
          n.includes('1200x800')
        );
      });
    }

    if (isOneWay1200x1000Damaged(selectedName)) {
      return palletTypes.filter((item) => {
        const n = normalize(item.name);

        return (
          !n.includes('ostec') &&
          n.includes('jednokrat') &&
          n.includes('1200x1000')
        );
      });
    }

    return [];
  }, [palletTypes, selectedDamagedPallet]);

  const currentDamagedStock = damagedPalletTypeId
    ? getCurrentStock(damagedPalletTypeId)
    : 0;

  const damagedQtyNumber = Number(damagedQuantity || 0);
  const repairedQtyNumber = Number(repairedQuantity || 0);
  const scrapQuantity = Math.max(damagedQtyNumber - repairedQtyNumber, 0);

  async function loadData() {
    setLoading(true);
    setErrorMessage('');
    setMessage('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from('users_profiles')
      .select('active')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profileData?.active) {
      alert('Korisnik nije aktivan.');
      router.push('/dashboard');
      return;
    }

    const { data: permissionData, error: permissionError } = await supabase
      .from('user_permissions')
      .select('can_adjust_stock')
      .eq('user_id', user.id)
      .maybeSingle();

    if (permissionError || !permissionData?.can_adjust_stock) {
      alert('Nemate dozvolu za popravku paleta.');
      router.push('/dashboard');
      return;
    }

    const palletTypesResult = await supabase
      .from('pallet_types')
      .select('id, name')
      .eq('active', true)
      .order('name', { ascending: true });

    const stockResult = await supabase
      .from('final_stock')
      .select('pallet_type_id, pallet_type_name, current_quantity');

    const repairsResult = await supabase
      .from('pallet_repairs')
      .select(`
        id,
        damaged_pallet_type_name,
        target_pallet_type_name,
        damaged_quantity,
        repaired_quantity,
        scrap_quantity,
        note,
        created_by_name,
        created_by_email,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    const loadedPalletTypes = (palletTypesResult.data || []) as PalletType[];

    setPalletTypes(loadedPalletTypes);
    setStock((stockResult.data || []) as StockItem[]);
    setRepairs((repairsResult.data || []) as RepairItem[]);

    const loadedDamagedOptions = loadedPalletTypes.filter((item) =>
      isDamagedPallet(item.name)
    );

    if (!damagedPalletTypeId && loadedDamagedOptions.length > 0) {
      setDamagedPalletTypeId(loadedDamagedOptions[0].id);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (targetOptions.length === 0) {
      setTargetPalletTypeId('');
      return;
    }

    const exists = targetOptions.some((item) => item.id === targetPalletTypeId);

    if (!exists) {
      setTargetPalletTypeId(targetOptions[0].id);
    }
  }, [targetOptions, targetPalletTypeId]);

  async function saveRepair(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setMessage('');
    setErrorMessage('');

    if (!damagedPalletTypeId) {
      setSaving(false);
      setErrorMessage('Izaberi oštećenu vrstu palete.');
      return;
    }

    if (!targetPalletTypeId) {
      setSaving(false);
      setErrorMessage('Izaberi u koju ispravnu paletu se prebacuje.');
      return;
    }

    if (!damagedQtyNumber || damagedQtyNumber <= 0) {
      setSaving(false);
      setErrorMessage('Unesi količinu oštećenih paleta.');
      return;
    }

    if (repairedQtyNumber <= 0) {
      setSaving(false);
      setErrorMessage('Unesi koliko je popravljeno.');
      return;
    }

    if (repairedQtyNumber > damagedQtyNumber) {
      setSaving(false);
      setErrorMessage('Popravljeno ne može biti veće od uzete količine oštećenih.');
      return;
    }

    if (damagedQtyNumber > currentDamagedStock) {
      setSaving(false);
      setErrorMessage(
        `Nema dovoljno oštećenih paleta. Trenutno stanje je ${currentDamagedStock} kom.`
      );
      return;
    }

    const { error } = await supabase.rpc('repair_pallets', {
      p_damaged_pallet_type_id: damagedPalletTypeId,
      p_target_pallet_type_id: targetPalletTypeId,
      p_damaged_quantity: damagedQtyNumber,
      p_repaired_quantity: repairedQtyNumber,
      p_scrap_quantity: scrapQuantity,
      p_note: note,
    });

    setSaving(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setDamagedQuantity('');
    setRepairedQuantity('');
    setNote('');
    setMessage('Popravka je uspešno sačuvana. Lager je automatski prebačen.');

    await loadData();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

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
          <p className="text-sm text-green-100">Popravka paleta</p>
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

        <Link className="bg-gray-100 px-4 py-2 rounded-xl" href="/korekcija-lagera">
          Korekcija lagera
        </Link>

        <Link className="bg-green-800 text-white px-4 py-2 rounded-xl" href="/popravka-paleta">
          Popravka paleta
        </Link>

        <Link className="bg-gray-100 px-4 py-2 rounded-xl" href="/lista-otkupa">
          Lista otkupa
        </Link>

        <Link className="bg-gray-100 px-4 py-2 rounded-xl" href="/lista-prodaje">
          Lista prodaje
        </Link>
      </nav>

      <section className="p-6 grid lg:grid-cols-2 gap-6">
        <form onSubmit={saveRepair} className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-2xl font-bold text-green-800">
            Unos popravke paleta
          </h2>

          <p className="text-sm text-gray-600 mt-2">
            Oštećene palete se skidaju sa lagera, a popravljena količina se automatski dodaje u ispravne palete.
          </p>

          {errorMessage ? (
            <div className="mt-4 bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm">
              Greška: {errorMessage}
            </div>
          ) : null}

          {message ? (
            <div className="mt-4 bg-green-50 text-green-800 px-4 py-3 rounded-xl text-sm">
              {message}
            </div>
          ) : null}

          <div className="mt-5">
            <label className="block text-sm font-medium text-gray-700">
              Oštećene palete
            </label>

            <select
              className="mt-1 w-full border rounded-xl px-4 py-3"
              value={damagedPalletTypeId}
              onChange={(event) => setDamagedPalletTypeId(event.target.value)}
              required
            >
              {damagedOptions.map((pallet) => (
                <option key={pallet.id} value={pallet.id}>
                  {pallet.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 bg-gray-50 rounded-xl p-4">
            <p className="text-sm text-gray-600">
              Trenutno stanje izabrane oštećene palete:
            </p>

            <p className="text-2xl font-bold text-green-800">
              {currentDamagedStock} kom
            </p>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">
              Prebaci popravljene u
            </label>

            <select
              className="mt-1 w-full border rounded-xl px-4 py-3"
              value={targetPalletTypeId}
              onChange={(event) => setTargetPalletTypeId(event.target.value)}
              required
            >
              {targetOptions.map((pallet) => (
                <option key={pallet.id} value={pallet.id}>
                  {pallet.name}
                </option>
              ))}
            </select>

            {targetOptions.length === 0 ? (
              <p className="text-sm text-red-700 mt-2">
                Nema pronađene ispravne palete za ovu vrstu. Proveri nazive u pallet_types.
              </p>
            ) : null}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">
                Uzeto oštećenih
              </label>

              <input
                className="mt-1 w-full border rounded-xl px-4 py-3"
                value={damagedQuantity}
                onChange={(event) => setDamagedQuantity(event.target.value)}
                type="number"
                min="1"
                required
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">
                Popravljeno
              </label>

              <input
                className="mt-1 w-full border rounded-xl px-4 py-3"
                value={repairedQuantity}
                onChange={(event) => setRepairedQuantity(event.target.value)}
                type="number"
                min="1"
                required
              />
            </div>
          </div>

          <div className="mt-4 bg-yellow-50 rounded-xl p-4">
            <p className="text-sm text-yellow-800">Škart / otpad:</p>

            <p className="text-2xl font-bold text-yellow-900">
              {scrapQuantity} kom
            </p>

            <p className="text-xs text-yellow-800 mt-1">
              Škart se računa automatski: uzeto oštećenih - popravljeno.
            </p>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">
              Napomena
            </label>

            <textarea
              className="mt-1 w-full border rounded-xl px-4 py-3"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Primer: popravljeno u radionici, deo otišao u škart..."
            />
          </div>

          <button
            type="submit"
            disabled={saving || targetOptions.length === 0}
            className="mt-6 w-full bg-green-800 text-white rounded-xl py-3 font-semibold hover:bg-green-900 disabled:opacity-60"
          >
            {saving ? 'Čuvanje...' : 'Sačuvaj popravku'}
          </button>
        </form>

        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-2xl font-bold text-green-800">
            Poslednje popravke
          </h2>

          <div className="mt-5 space-y-3">
            {repairs.map((repair) => (
              <div key={repair.id} className="border rounded-2xl p-4 bg-gray-50">
                <p className="font-bold text-green-900">
                  {repair.damaged_pallet_type_name}
                </p>

                <p className="text-sm text-gray-700 mt-1">
                  Prebačeno u: <b>{repair.target_pallet_type_name}</b>
                </p>

                <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
                  <div className="bg-white rounded-xl p-2">
                    <p className="text-gray-500">Uzeto</p>
                    <p className="font-bold">{repair.damaged_quantity} kom</p>
                  </div>

                  <div className="bg-white rounded-xl p-2">
                    <p className="text-gray-500">Popravljeno</p>
                    <p className="font-bold">{repair.repaired_quantity} kom</p>
                  </div>

                  <div className="bg-white rounded-xl p-2">
                    <p className="text-gray-500">Škart</p>
                    <p className="font-bold">{repair.scrap_quantity} kom</p>
                  </div>
                </div>

                <p className="text-sm text-gray-600 mt-3">
                  Unos: <b>{repair.created_by_name || repair.created_by_email || '-'}</b>
                </p>

                <p className="text-sm text-gray-600">
                  Datum: {formatDateTime(repair.created_at)}
                </p>

                {repair.note ? (
                  <p className="text-sm text-gray-700 mt-2">
                    <b>Napomena:</b> {repair.note}
                  </p>
                ) : null}
              </div>
            ))}

            {repairs.length === 0 ? (
              <p className="text-gray-500">Još nema evidentiranih popravki.</p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}