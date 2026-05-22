'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabaseUrl = 'https://cqwiblmohdjehbeifnko.supabase.co';
const supabaseKey = 'sb_publishable_S8mQrQ5iL8F1ZmO1zjqQfg_ePTqKSZf';

const supabase = createClient(supabaseUrl, supabaseKey);

type Customer = {
  id: string;
  name: string;
};

type PalletType = {
  id: string;
  name: string;
};

type StockItem = {
  pallet_type_id: string;
  pallet_type_name: string;
  current_quantity: number;
};

export default function ProdajaPage() {
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [palletTypes, setPalletTypes] = useState<PalletType[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customerId, setCustomerId] = useState('');
  const [palletTypeId, setPalletTypeId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [saleDate, setSaleDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');

  async function loadData() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    const customersResult = await supabase
      .from('customers')
      .select('id, name')
      .order('name', { ascending: true });

    const palletTypesResult = await supabase
      .from('pallet_types')
      .select('id, name')
      .eq('active', true)
      .order('name', { ascending: true });

    const stockResult = await supabase
      .from('final_stock')
      .select('pallet_type_id, pallet_type_name, current_quantity');

    if (customersResult.data) {
      setCustomers(customersResult.data as Customer[]);

      if (!customerId && customersResult.data.length > 0) {
        setCustomerId(customersResult.data[0].id);
      }
    }

    if (palletTypesResult.data) {
      setPalletTypes(palletTypesResult.data as PalletType[]);

      if (!palletTypeId && palletTypesResult.data.length > 0) {
        setPalletTypeId(palletTypesResult.data[0].id);
      }
    }

    if (stockResult.data) {
      setStock(stockResult.data as StockItem[]);
    } else {
      setStock([]);
    }

    const today = new Date().toISOString().slice(0, 10);

    if (!saleDate) {
      setSaleDate(today);
    }

    if (!deliveryDate) {
      setDeliveryDate(today);
    }

    setLoading(false);
  }

  function getCurrentStock() {
    const found = stock.find((item) => item.pallet_type_id === palletTypeId);
    return found ? Number(found.current_quantity || 0) : 0;
  }

  async function saveSale(e: any) {
    e.preventDefault();

    setSaving(true);
    setMessage('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    const currentStock = getCurrentStock();
    const saleQuantity = Number(quantity);

    if (!customerId) {
      setSaving(false);
      setMessage('Greška: izaberi kupca.');
      return;
    }

    if (!palletTypeId) {
      setSaving(false);
      setMessage('Greška: izaberi vrstu palete.');
      return;
    }

    if (!saleQuantity || saleQuantity <= 0) {
      setSaving(false);
      setMessage('Greška: unesi ispravnu količinu.');
      return;
    }

    if (saleQuantity > currentStock) {
      setSaving(false);
      setMessage(
        `Greška: nema dovoljno paleta na stanju. Trenutno stanje je ${currentStock} kom.`
      );
      return;
    }

    const { error } = await supabase.from('sales').insert({
      customer_id: customerId,
      pallet_type_id: palletTypeId,
      quantity: saleQuantity,
      sale_price: Number(salePrice),
      sale_date: saleDate,
      delivery_date: deliveryDate || null,
      payment_status: paymentStatus,
      payment_method: paymentMethod,
      note: note,
      created_by: user.id,
    });

    setSaving(false);

    if (error) {
      setMessage('Greška: prodaja nije sačuvana. ' + error.message);
      return;
    }

    setQuantity('');
    setSalePrice('');
    setNote('');
    setPaymentStatus('paid');
    setPaymentMethod('cash');
    setMessage('Prodaja je uspešno sačuvana. Lager je automatski umanjen.');

    await loadData();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p>Učitavanje...</p>
      </main>
    );
  }

  const currentStock = getCurrentStock();

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="bg-green-900 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Euro Trade Plus</h1>
          <p className="text-sm text-green-100">Nova prodaja</p>
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

        <Link className="bg-green-800 text-white px-4 py-2 rounded-xl" href="/prodaja">
          Nova prodaja
        </Link>

        <Link className="bg-gray-100 px-4 py-2 rounded-xl" href="/dobavljaci">
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

      <section className="p-6">
        <form onSubmit={saveSale} className="bg-white rounded-2xl shadow p-6 max-w-3xl">
          <h2 className="text-2xl font-bold text-green-800">
            Unos prodaje paleta
          </h2>

          {customers.length === 0 ? (
            <div className="mt-5 bg-yellow-50 text-yellow-800 px-4 py-3 rounded-xl text-sm">
              Nema unetih kupaca. Prvo dodaj kupca na stranici Kupci.
            </div>
          ) : null}

          <div className="mt-5">
            <label className="block text-sm font-medium text-gray-700">
              Kupac
            </label>
            <select
              className="mt-1 w-full border rounded-xl px-4 py-3"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
            >
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">
              Vrsta palete
            </label>
            <select
              className="mt-1 w-full border rounded-xl px-4 py-3"
              value={palletTypeId}
              onChange={(e) => setPalletTypeId(e.target.value)}
              required
            >
              {palletTypes.map((pallet) => (
                <option key={pallet.id} value={pallet.id}>
                  {pallet.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 bg-gray-50 rounded-xl p-4">
            <p className="text-sm text-gray-600">Trenutno stanje za izabranu paletu:</p>
            <p className="text-2xl font-bold text-green-800">
              {currentStock} kom
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">
                Količina
              </label>
              <input
                className="mt-1 w-full border rounded-xl px-4 py-3"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                type="number"
                min="1"
                required
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">
                Prodajna cena po komadu
              </label>
              <input
                className="mt-1 w-full border rounded-xl px-4 py-3"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                type="number"
                min="0"
                step="0.01"
                required
              />
            </div>
          </div>

          <div className="mt-4 bg-gray-50 rounded-xl p-4">
            <p className="text-sm text-gray-600">Ukupna vrednost prodaje:</p>
            <p className="text-2xl font-bold text-green-800">
              {new Intl.NumberFormat('sr-RS').format(
                Number(quantity || 0) * Number(salePrice || 0)
              )}{' '}
              RSD
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">
                Datum prodaje
              </label>
              <input
                className="mt-1 w-full border rounded-xl px-4 py-3"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                type="date"
                required
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">
                Datum isporuke
              </label>
              <input
                className="mt-1 w-full border rounded-xl px-4 py-3"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                type="date"
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">
                Status plaćanja
              </label>
              <select
                className="mt-1 w-full border rounded-xl px-4 py-3"
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
              >
                <option value="paid">Plaćeno</option>
                <option value="unpaid">Nije plaćeno</option>
                <option value="partial">Delimično plaćeno</option>
              </select>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">
                Način plaćanja
              </label>
              <select
                className="mt-1 w-full border rounded-xl px-4 py-3"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="cash">Gotovina</option>
                <option value="bank">Račun</option>
                <option value="other">Ostalo</option>
              </select>
            </div>
          </div>

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
            disabled={saving || customers.length === 0}
            className="mt-6 w-full bg-green-800 text-white rounded-xl py-3 font-semibold hover:bg-green-900 disabled:opacity-60"
          >
            {saving ? 'Čuvanje...' : 'Sačuvaj prodaju'}
          </button>
        </form>
      </section>
    </main>
  );
}