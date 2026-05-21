'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabaseUrl = 'https://cqwiblmohdjehbeifnko.supabase.co';
const supabaseKey = 'sb_publishable_S8mQrQ5iL8F1ZmO1zjqQfg_ePTqKSZf';

const supabase = createClient(supabaseUrl, supabaseKey);

type PurchaseDebt = {
  id: string;
  quantity: number;
  purchase_price: number;
  total_amount: number;
  purchase_date: string;
  payment_status: string;
  payment_method: string;
  note: string | null;
  suppliers: {
    name: string;
  } | null;
  pallet_types: {
    name: string;
  } | null;
};

type SaleDebt = {
  id: string;
  quantity: number;
  sale_price: number;
  total_amount: number;
  sale_date: string;
  delivery_date: string | null;
  payment_status: string;
  payment_method: string;
  note: string | null;
  customers: {
    name: string;
  } | null;
  pallet_types: {
    name: string;
  } | null;
};

export default function DugovanjaPage() {
  const router = useRouter();

  const [purchaseDebts, setPurchaseDebts] = useState<PurchaseDebt[]>([]);
  const [saleDebts, setSaleDebts] = useState<SaleDebt[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [message, setMessage] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [debtTypeFilter, setDebtTypeFilter] = useState('');

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
      .select('can_view_finances')
      .eq('user_id', user.id)
      .maybeSingle();

    if (permissionError) {
      alert('Greška pri proveri dozvole: ' + permissionError.message);
      router.push('/dashboard');
      return;
    }

    if (!permissionData?.can_view_finances) {
      alert('Nemate dozvolu za dugovanja.');
      router.push('/dashboard');
      return;
    }

    const purchasesResult = await supabase
      .from('purchases')
      .select(`
        id,
        quantity,
        purchase_price,
        total_amount,
        purchase_date,
        payment_status,
        payment_method,
        note,
        suppliers (
          name
        ),
        pallet_types (
          name
        )
      `)
      .in('payment_status', ['unpaid', 'partial'])
      .or('deleted.is.null,deleted.eq.false')
      .order('purchase_date', { ascending: false });

    const salesResult = await supabase
      .from('sales')
      .select(`
        id,
        quantity,
        sale_price,
        total_amount,
        sale_date,
        delivery_date,
        payment_status,
        payment_method,
        note,
        customers (
          name
        ),
        pallet_types (
          name
        )
      `)
      .in('payment_status', ['unpaid', 'partial'])
      .or('deleted.is.null,deleted.eq.false')
      .order('sale_date', { ascending: false });

    if (purchasesResult.error) {
      setErrorMessage(purchasesResult.error.message);
    }

    if (salesResult.error) {
      setErrorMessage(salesResult.error.message);
    }

    if (purchasesResult.data) {
      setPurchaseDebts(purchasesResult.data as unknown as PurchaseDebt[]);
    }

    if (salesResult.data) {
      setSaleDebts(salesResult.data as unknown as SaleDebt[]);
    }

    setLoading(false);
  }

  async function markSalePaid(id: string) {
    const confirmed = window.confirm(
      'Da li sigurno želiš da označiš ovu prodaju kao plaćenu?'
    );

    if (!confirmed) return;

    setSavingId(id);
    setMessage('');
    setErrorMessage('');

    const { error } = await supabase
      .from('sales')
      .update({ payment_status: 'paid' })
      .eq('id', id);

    setSavingId('');

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setMessage('Prodaja je označena kao plaćena.');
    await loadData();
  }

  async function markPurchasePaid(id: string) {
    const confirmed = window.confirm(
      'Da li sigurno želiš da označiš ovaj otkup kao plaćen?'
    );

    if (!confirmed) return;

    setSavingId(id);
    setMessage('');
    setErrorMessage('');

    const { error } = await supabase
      .from('purchases')
      .update({ payment_status: 'paid' })
      .eq('id', id);

    setSavingId('');

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setMessage('Otkup je označen kao plaćen.');
    await loadData();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  function paymentStatusText(status: string) {
    if (status === 'paid') return 'Plaćeno';
    if (status === 'unpaid') return 'Nije plaćeno';
    if (status === 'partial') return 'Delimično plaćeno';
    return status;
  }

  function paymentMethodText(method: string) {
    if (method === 'cash') return 'Gotovina';
    if (method === 'bank') return 'Račun';
    if (method === 'other') return 'Ostalo';
    return method;
  }

  function formatRsd(value: number) {
    return new Intl.NumberFormat('sr-RS').format(Number(value)) + ' RSD';
  }

  function formatDate(date: string | null) {
    if (!date) return '-';

    const onlyDate = date.split('T')[0];
    const parts = onlyDate.split('-');

    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}.`;
    }

    return date;
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredSaleDebts = useMemo(() => {
    return saleDebts.filter((sale) => {
      const search = searchTerm.toLowerCase().trim();

      const customerName = sale.customers?.name?.toLowerCase() || '';
      const palletName = sale.pallet_types?.name?.toLowerCase() || '';
      const note = sale.note?.toLowerCase() || '';

      const matchesSearch =
        !search ||
        customerName.includes(search) ||
        palletName.includes(search) ||
        note.includes(search) ||
        String(sale.quantity).includes(search) ||
        String(sale.total_amount).includes(search);

      const matchesDateFrom = !dateFrom || sale.sale_date >= dateFrom;
      const matchesDateTo = !dateTo || sale.sale_date <= dateTo;

      const matchesStatus =
        !paymentStatusFilter || sale.payment_status === paymentStatusFilter;

      const matchesMethod =
        !paymentMethodFilter || sale.payment_method === paymentMethodFilter;

      const matchesType = !debtTypeFilter || debtTypeFilter === 'sales';

      return (
        matchesSearch &&
        matchesDateFrom &&
        matchesDateTo &&
        matchesStatus &&
        matchesMethod &&
        matchesType
      );
    });
  }, [
    saleDebts,
    searchTerm,
    dateFrom,
    dateTo,
    paymentStatusFilter,
    paymentMethodFilter,
    debtTypeFilter,
  ]);

  const filteredPurchaseDebts = useMemo(() => {
    return purchaseDebts.filter((purchase) => {
      const search = searchTerm.toLowerCase().trim();

      const supplierName = purchase.suppliers?.name?.toLowerCase() || '';
      const palletName = purchase.pallet_types?.name?.toLowerCase() || '';
      const note = purchase.note?.toLowerCase() || '';

      const matchesSearch =
        !search ||
        supplierName.includes(search) ||
        palletName.includes(search) ||
        note.includes(search) ||
        String(purchase.quantity).includes(search) ||
        String(purchase.total_amount).includes(search);

      const matchesDateFrom = !dateFrom || purchase.purchase_date >= dateFrom;
      const matchesDateTo = !dateTo || purchase.purchase_date <= dateTo;

      const matchesStatus =
        !paymentStatusFilter || purchase.payment_status === paymentStatusFilter;

      const matchesMethod =
        !paymentMethodFilter || purchase.payment_method === paymentMethodFilter;

      const matchesType = !debtTypeFilter || debtTypeFilter === 'purchases';

      return (
        matchesSearch &&
        matchesDateFrom &&
        matchesDateTo &&
        matchesStatus &&
        matchesMethod &&
        matchesType
      );
    });
  }, [
    purchaseDebts,
    searchTerm,
    dateFrom,
    dateTo,
    paymentStatusFilter,
    paymentMethodFilter,
    debtTypeFilter,
  ]);

  const totalCustomerDebt = filteredSaleDebts.reduce(
    (sum, item) => sum + Number(item.total_amount),
    0
  );

  const totalSupplierDebt = filteredPurchaseDebts.reduce(
    (sum, item) => sum + Number(item.total_amount),
    0
  );

  const totalUnpaidSales = filteredSaleDebts
    .filter((item) => item.payment_status === 'unpaid')
    .reduce((sum, item) => sum + Number(item.total_amount), 0);

  const totalPartialSales = filteredSaleDebts
    .filter((item) => item.payment_status === 'partial')
    .reduce((sum, item) => sum + Number(item.total_amount), 0);

  const totalUnpaidPurchases = filteredPurchaseDebts
    .filter((item) => item.payment_status === 'unpaid')
    .reduce((sum, item) => sum + Number(item.total_amount), 0);

  const totalPartialPurchases = filteredPurchaseDebts
    .filter((item) => item.payment_status === 'partial')
    .reduce((sum, item) => sum + Number(item.total_amount), 0);

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
          <p className="text-sm text-green-100">Dugovanja</p>
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

        <Link className="bg-green-800 text-white px-4 py-2 rounded-xl" href="/dugovanja">
          Dugovanja
        </Link>

        <Link className="bg-gray-100 px-4 py-2 rounded-xl" href="/izvestaji">
          Izveštaji
        </Link>
      </nav>

      <section className="p-6">
        {errorMessage ? (
          <div className="mb-4 bg-red-50 text-red-700 px-4 py-3 rounded-xl">
            Greška: {errorMessage}
          </div>
        ) : null}

        {message ? (
          <div className="mb-4 bg-green-50 text-green-800 px-4 py-3 rounded-xl">
            {message}
          </div>
        ) : null}

        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-600 text-sm">Kupci duguju firmi</p>
            <p className="text-3xl font-bold text-red-700 mt-2">
              {formatRsd(totalCustomerDebt)}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-600 text-sm">Firma duguje dobavljačima</p>
            <p className="text-3xl font-bold text-red-700 mt-2">
              {formatRsd(totalSupplierDebt)}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-600 text-sm">Neplaćeno ukupno</p>
            <p className="text-3xl font-bold text-red-700 mt-2">
              {formatRsd(totalUnpaidSales + totalUnpaidPurchases)}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-600 text-sm">Delimično ukupno</p>
            <p className="text-3xl font-bold text-yellow-700 mt-2">
              {formatRsd(totalPartialSales + totalPartialPurchases)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-green-800 mb-4">
            Pretraga i filteri
          </h2>

          <div className="grid md:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Pretraga
              </label>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Kupac, dobavljač, paleta..."
                className="w-full border rounded-xl px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Od datuma
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="w-full border rounded-xl px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Do datuma
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="w-full border rounded-xl px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Tip
              </label>
              <select
                value={debtTypeFilter}
                onChange={(event) => setDebtTypeFilter(event.target.value)}
                className="w-full border rounded-xl px-3 py-2"
              >
                <option value="">Sve</option>
                <option value="sales">Kupci duguju firmi</option>
                <option value="purchases">Firma duguje dobavljačima</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Status
              </label>
              <select
                value={paymentStatusFilter}
                onChange={(event) => setPaymentStatusFilter(event.target.value)}
                className="w-full border rounded-xl px-3 py-2"
              >
                <option value="">Svi statusi</option>
                <option value="unpaid">Nije plaćeno</option>
                <option value="partial">Delimično plaćeno</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Način
              </label>
              <select
                value={paymentMethodFilter}
                onChange={(event) => setPaymentMethodFilter(event.target.value)}
                className="w-full border rounded-xl px-3 py-2"
              >
                <option value="">Svi načini</option>
                <option value="cash">Gotovina</option>
                <option value="bank">Račun</option>
                <option value="other">Ostalo</option>
              </select>
            </div>
          </div>

          <button
            onClick={() => {
              setSearchTerm('');
              setDateFrom('');
              setDateTo('');
              setPaymentStatusFilter('');
              setPaymentMethodFilter('');
              setDebtTypeFilter('');
            }}
            className="mt-4 bg-gray-100 px-4 py-2 rounded-xl font-semibold"
          >
            Poništi filtere
          </button>
        </div>

        {debtTypeFilter !== 'purchases' ? (
          <div className="bg-white rounded-2xl shadow p-6 mb-6">
            <div className="flex flex-wrap justify-between gap-3 items-center">
              <div>
                <h2 className="text-2xl font-bold text-green-800">
                  Dugovanja kupaca prema firmi
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Filtrirano: {filteredSaleDebts.length} stavki /{' '}
                  {formatRsd(totalCustomerDebt)}
                </p>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="p-3">Datum prodaje</th>
                    <th className="p-3">Datum isporuke</th>
                    <th className="p-3">Kupac</th>
                    <th className="p-3">Vrsta palete</th>
                    <th className="p-3">Količina</th>
                    <th className="p-3">Cena/kom</th>
                    <th className="p-3">Dug</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Način</th>
                    <th className="p-3">Napomena</th>
                    <th className="p-3">Akcija</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredSaleDebts.map((sale) => (
                    <tr key={sale.id} className="border-b">
                      <td className="p-3">{formatDate(sale.sale_date)}</td>

                      <td className="p-3">{formatDate(sale.delivery_date)}</td>

                      <td className="p-3 font-medium">
                        {sale.customers?.name || '-'}
                      </td>

                      <td className="p-3">
                        {sale.pallet_types?.name || '-'}
                      </td>

                      <td className="p-3">{sale.quantity}</td>

                      <td className="p-3">
                        {formatRsd(Number(sale.sale_price))}
                      </td>

                      <td className="p-3 font-semibold text-red-700">
                        {formatRsd(Number(sale.total_amount))}
                      </td>

                      <td className="p-3">
                        {paymentStatusText(sale.payment_status)}
                      </td>

                      <td className="p-3">
                        {paymentMethodText(sale.payment_method)}
                      </td>

                      <td className="p-3">{sale.note || '-'}</td>

                      <td className="p-3">
                        <button
                          onClick={() => markSalePaid(sale.id)}
                          disabled={savingId === sale.id}
                          className="bg-green-800 text-white px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-60"
                        >
                          {savingId === sale.id ? 'Čuvanje...' : 'Označi kao plaćeno'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredSaleDebts.length === 0 ? (
                <p className="text-gray-500 mt-4">
                  Nema dugovanja kupaca za izabrane filtere.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {debtTypeFilter !== 'sales' ? (
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex flex-wrap justify-between gap-3 items-center">
              <div>
                <h2 className="text-2xl font-bold text-green-800">
                  Dugovanja firme prema dobavljačima
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Filtrirano: {filteredPurchaseDebts.length} stavki /{' '}
                  {formatRsd(totalSupplierDebt)}
                </p>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="p-3">Datum otkupa</th>
                    <th className="p-3">Dobavljač</th>
                    <th className="p-3">Vrsta palete</th>
                    <th className="p-3">Količina</th>
                    <th className="p-3">Cena/kom</th>
                    <th className="p-3">Dug</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Način</th>
                    <th className="p-3">Napomena</th>
                    <th className="p-3">Akcija</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredPurchaseDebts.map((purchase) => (
                    <tr key={purchase.id} className="border-b">
                      <td className="p-3">{formatDate(purchase.purchase_date)}</td>

                      <td className="p-3 font-medium">
                        {purchase.suppliers?.name || '-'}
                      </td>

                      <td className="p-3">
                        {purchase.pallet_types?.name || '-'}
                      </td>

                      <td className="p-3">{purchase.quantity}</td>

                      <td className="p-3">
                        {formatRsd(Number(purchase.purchase_price))}
                      </td>

                      <td className="p-3 font-semibold text-red-700">
                        {formatRsd(Number(purchase.total_amount))}
                      </td>

                      <td className="p-3">
                        {paymentStatusText(purchase.payment_status)}
                      </td>

                      <td className="p-3">
                        {paymentMethodText(purchase.payment_method)}
                      </td>

                      <td className="p-3">{purchase.note || '-'}</td>

                      <td className="p-3">
                        <button
                          onClick={() => markPurchasePaid(purchase.id)}
                          disabled={savingId === purchase.id}
                          className="bg-green-800 text-white px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-60"
                        >
                          {savingId === purchase.id ? 'Čuvanje...' : 'Označi kao plaćeno'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredPurchaseDebts.length === 0 ? (
                <p className="text-gray-500 mt-4">
                  Nema dugovanja prema dobavljačima za izabrane filtere.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}