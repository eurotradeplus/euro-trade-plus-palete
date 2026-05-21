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

type AdjustmentRow = {
  id: string;
  adjustment_type: string;
  quantity: number;
  reason: string | null;
  created_at: string;
  pallet_type_id: string;
  created_by_email: string | null;
};

export default function KorekcijaLageraPage() {
  const router = useRouter();

  const [stock, setStock] = useState<StockItem[]>([]);
  const [palletTypes, setPalletTypes] = useState<PalletType[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>([]);

  const [palletTypeId, setPalletTypeId] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'increase' | 'decrease'>('increase');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [adjustmentFilter, setAdjustmentFilter] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    checkUserAndLoadData();
  }, []);

  async function checkUserAndLoadData() {
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

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

    if (profileError) {
      alert('Greška pri proveri korisnika: ' + profileError.message);
      router.push('/dashboard');
      return;
    }

    if (!profileData?.active) {
      await supabase.auth.signOut();
      router.push('/login');
      return;
    }

    const { data: permissionData, error: permissionError } = await supabase
      .from('user_permissions')
      .select('can_adjust_stock')
      .eq('user_id', user.id)
      .maybeSingle();

    if (permissionError) {
      alert('Greška pri proveri dozvole: ' + permissionError.message);
      router.push('/dashboard');
      return;
    }

    if (!permissionData?.can_adjust_stock) {
      alert('Nemate dozvolu za korekciju lagera.');
      router.push('/dashboard');
      return;
    }

    await loadData();
  }

  async function loadData() {
    setLoading(true);
    setErrorMessage('');

    const { data: palletTypesData, error: palletTypesError } = await supabase
      .from('pallet_types')
      .select('id, name')
      .order('name', { ascending: true });

    if (palletTypesError) {
      setErrorMessage('Greška pri učitavanju tipova paleta: ' + palletTypesError.message);
      setLoading(false);
      return;
    }

    const { data: stockData, error: stockError } = await supabase
      .from('final_stock')
      .select('pallet_type_id, pallet_type_name, current_quantity')
      .order('pallet_type_name', { ascending: true });

    if (stockError) {
      setErrorMessage('Greška pri učitavanju lagera: ' + stockError.message);
      setLoading(false);
      return;
    }

    const types = palletTypesData || [];
    const stockRows = (stockData || []) as StockItem[];

    const combinedStock: StockItem[] = types.map((type) => {
      const foundStock = stockRows.find((item) => item.pallet_type_id === type.id);

      return {
        pallet_type_id: type.id,
        pallet_type_name: type.name,
        current_quantity: Number(foundStock?.current_quantity || 0),
      };
    });

    setPalletTypes(types);
    setStock(combinedStock);

    if (!palletTypeId && types.length > 0) {
      setPalletTypeId(types[0].id);
    }

    const { data: adjustmentsData, error: adjustmentsError } = await supabase
      .from('stock_adjustments')
      .select('id, adjustment_type, quantity, reason, created_at, pallet_type_id, created_by_email')
      .order('created_at', { ascending: false })
      .limit(100);

    if (adjustmentsError) {
      setErrorMessage('Greška pri učitavanju korekcija: ' + adjustmentsError.message);
      setAdjustments([]);
    } else {
      setAdjustments((adjustmentsData || []) as AdjustmentRow[]);
    }

    setLoading(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');

    if (!palletTypeId) {
      setErrorMessage('Izaberi tip palete.');
      return;
    }

    const numericQuantity = Number(quantity);

    if (!numericQuantity || Number.isNaN(numericQuantity) || numericQuantity <= 0) {
      setErrorMessage('Unesi ispravnu količinu.');
      return;
    }

    if (!reason.trim()) {
      setErrorMessage('Unesi razlog korekcije.');
      return;
    }

    const selectedStock = stock.find((item) => item.pallet_type_id === palletTypeId);

    if (
      adjustmentType === 'decrease' &&
      selectedStock &&
      numericQuantity > Number(selectedStock.current_quantity)
    ) {
      const confirmed = window.confirm(
        'Skidaš veću količinu nego što trenutno ima na lageru. Lager može otići u minus. Da li želiš da nastaviš?'
      );

      if (!confirmed) return;
    }

    const actionText = adjustmentType === 'increase' ? 'dodavanje na lager' : 'skidanje sa lagera';

    const confirmed = window.confirm(
      `Potvrdi korekciju: ${actionText}, količina ${numericQuantity} kom.`
    );

    if (!confirmed) return;

    setSaving(true);

    const { error } = await supabase.rpc('adjust_stock', {
      p_pallet_type_id: palletTypeId,
      p_adjustment_type: adjustmentType,
      p_quantity: numericQuantity,
      p_reason: reason.trim(),
    });

    setSaving(false);

    if (error) {
      setErrorMessage('Greška: ' + error.message);
      return;
    }

    setQuantity('');
    setReason('');
    setAdjustmentType('increase');

    setSuccessMessage('Korekcija lagera je uspešno sačuvana.');
    await loadData();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  function getPalletName(id: string) {
    return palletTypes.find((pallet) => pallet.id === id)?.name || 'Nepoznata paleta';
  }

  function adjustmentTypeText(type: string) {
    if (type === 'increase') return 'Dodato';
    if (type === 'decrease') return 'Skinuto';
    return type;
  }

  function adjustmentTypeClass(type: string) {
    if (type === 'increase') {
      return 'bg-green-50 text-green-800 border border-green-200';
    }

    return 'bg-red-50 text-red-800 border border-red-200';
  }

  function formatDateTime(value: string | null) {
    if (!value) return '-';

    const date = new Date(value);

    return date.toLocaleString('sr-RS', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const selectedStockItem = stock.find((item) => item.pallet_type_id === palletTypeId);

  const totalStockQuantity = stock.reduce(
    (sum, item) => sum + Number(item.current_quantity),
    0
  );

  const lowStockItems = stock.filter((item) => Number(item.current_quantity) <= 0);

  const filteredAdjustments = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();

    return adjustments.filter((item) => {
      const palletName = getPalletName(item.pallet_type_id).toLowerCase();
      const userEmail = item.created_by_email?.toLowerCase() || '';
      const itemReason = item.reason?.toLowerCase() || '';

      const matchesSearch =
        !search ||
        palletName.includes(search) ||
        userEmail.includes(search) ||
        itemReason.includes(search) ||
        String(item.quantity).includes(search);

      const matchesType = !adjustmentFilter || item.adjustment_type === adjustmentFilter;

      return matchesSearch && matchesType;
    });
  }, [adjustments, searchTerm, adjustmentFilter, palletTypes]);

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
          <p className="text-sm text-green-100">Korekcija lagera</p>
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

        <Link className="bg-gray-100 px-4 py-2 rounded-xl" href="/lista-otkupa">
          Lista otkupa
        </Link>

        <Link className="bg-gray-100 px-4 py-2 rounded-xl" href="/lista-prodaje">
          Lista prodaje
        </Link>

        <Link className="bg-gray-100 px-4 py-2 rounded-xl" href="/dugovanja">
          Dugovanja
        </Link>

        <Link className="bg-gray-100 px-4 py-2 rounded-xl" href="/izvestaji">
          Izveštaji
        </Link>

        <Link className="bg-green-800 text-white px-4 py-2 rounded-xl" href="/korekcija-lagera">
          Korekcija lagera
        </Link>
      </nav>

      <section className="p-6">
        {errorMessage ? (
          <div className="mb-4 bg-red-50 text-red-700 px-4 py-3 rounded-xl">
            Greška: {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="mb-4 bg-green-50 text-green-800 px-4 py-3 rounded-xl">
            {successMessage}
          </div>
        ) : null}

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-600 text-sm">Ukupno na lageru</p>
            <p className="text-3xl font-bold text-green-800 mt-2">
              {totalStockQuantity} kom
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-600 text-sm">Tipova paleta</p>
            <p className="text-3xl font-bold text-green-800 mt-2">
              {stock.length}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-600 text-sm">Nula ili minus lager</p>
            <p className="text-3xl font-bold text-red-700 mt-2">
              {lowStockItems.length}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-6 mb-6">
          <h2 className="text-2xl font-bold text-green-800">
            Nova korekcija
          </h2>

          <p className="text-sm text-gray-600 mt-1 mb-5">
            Ručno dodavanje ili skidanje paleta sa lagera. Svaka korekcija ostaje zapisana u istoriji.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Tip palete
                </label>
                <select
                  value={palletTypeId}
                  onChange={(event) => setPalletTypeId(event.target.value)}
                  className="w-full border rounded-xl px-3 py-2"
                >
                  {palletTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Trenutno stanje
                </label>
                <div className="w-full border rounded-xl px-3 py-2 bg-gray-50 font-semibold">
                  {selectedStockItem ? selectedStockItem.current_quantity : 0} kom
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Tip korekcije
                </label>
                <select
                  value={adjustmentType}
                  onChange={(event) =>
                    setAdjustmentType(event.target.value as 'increase' | 'decrease')
                  }
                  className="w-full border rounded-xl px-3 py-2"
                >
                  <option value="increase">Dodaj na lager</option>
                  <option value="decrease">Skini sa lagera</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Količina
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  placeholder="Na primer: 50"
                  className="w-full border rounded-xl px-3 py-2"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm text-gray-600 mb-1">
                Razlog korekcije
              </label>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Na primer: fizički popis, oštećene palete, greška u unosu..."
                className="w-full border rounded-xl px-3 py-2 min-h-[100px]"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="bg-green-800 text-white px-5 py-3 rounded-xl font-semibold disabled:opacity-60"
              >
                {saving ? 'Čuvanje...' : 'Sačuvaj korekciju'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setQuantity('');
                  setReason('');
                  setAdjustmentType('increase');
                }}
                className="bg-gray-100 px-5 py-3 rounded-xl font-semibold"
              >
                Poništi unos
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-2xl shadow p-6 mb-6">
          <h2 className="text-2xl font-bold text-green-800">
            Trenutni lager
          </h2>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-3">Tip palete</th>
                  <th className="p-3">Količina</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>

              <tbody>
                {stock.map((item) => (
                  <tr key={item.pallet_type_id} className="border-b">
                    <td className="p-3 font-medium">
                      {item.pallet_type_name}
                    </td>

                    <td
                      className={
                        Number(item.current_quantity) > 0
                          ? 'p-3 font-semibold text-green-800'
                          : 'p-3 font-semibold text-red-700'
                      }
                    >
                      {item.current_quantity} kom
                    </td>

                    <td className="p-3">
                      {Number(item.current_quantity) > 0 ? (
                        <span className="bg-green-50 text-green-800 border border-green-200 px-3 py-1 rounded-xl text-xs font-semibold">
                          Ima na lageru
                        </span>
                      ) : (
                        <span className="bg-red-50 text-red-800 border border-red-200 px-3 py-1 rounded-xl text-xs font-semibold">
                          Nema / minus
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {stock.length === 0 ? (
              <p className="text-gray-500 mt-4">
                Nema podataka o lageru.
              </p>
            ) : null}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex flex-wrap justify-between gap-3 items-center mb-5">
            <div>
              <h2 className="text-2xl font-bold text-green-800">
                Poslednje korekcije
              </h2>
              <p className="text-sm text-gray-600">
                Prikazuje poslednjih 100 korekcija lagera.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-5">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Pretraga
              </label>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Paleta, korisnik, razlog..."
                className="w-full border rounded-xl px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Tip korekcije
              </label>
              <select
                value={adjustmentFilter}
                onChange={(event) => setAdjustmentFilter(event.target.value)}
                className="w-full border rounded-xl px-3 py-2"
              >
                <option value="">Sve korekcije</option>
                <option value="increase">Dodato</option>
                <option value="decrease">Skinuto</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setAdjustmentFilter('');
                }}
                className="w-full bg-gray-100 px-4 py-2 rounded-xl font-semibold"
              >
                Poništi filtere
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-3">Datum</th>
                  <th className="p-3">Korisnik</th>
                  <th className="p-3">Tip palete</th>
                  <th className="p-3">Korekcija</th>
                  <th className="p-3">Količina</th>
                  <th className="p-3">Razlog</th>
                </tr>
              </thead>

              <tbody>
                {filteredAdjustments.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="p-3">
                      {formatDateTime(item.created_at)}
                    </td>

                    <td className="p-3">
                      {item.created_by_email || 'Nepoznat korisnik'}
                    </td>

                    <td className="p-3 font-medium">
                      {getPalletName(item.pallet_type_id)}
                    </td>

                    <td className="p-3">
                      <span
                        className={`px-3 py-1 rounded-xl text-xs font-semibold ${adjustmentTypeClass(
                          item.adjustment_type
                        )}`}
                      >
                        {adjustmentTypeText(item.adjustment_type)}
                      </span>
                    </td>

                    <td className="p-3 font-semibold">
                      {item.quantity} kom
                    </td>

                    <td className="p-3">
                      {item.reason || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredAdjustments.length === 0 ? (
              <p className="text-gray-500 mt-4">
                Nema korekcija za izabrane filtere.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}