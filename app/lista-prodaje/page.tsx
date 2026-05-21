'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabaseUrl = 'https://cqwiblmohdjehbeifnko.supabase.co';
const supabaseKey = 'sb_publishable_S8mQrQ5iL8F1ZmO1zjqQfg_ePTqKSZf';

const supabase = createClient(supabaseUrl, supabaseKey);

type Sale = {
  id: string;
  quantity: number;
  sale_price: number;
  total_amount: number;
  sale_date: string;
  delivery_date: string | null;
  payment_status: string;
  payment_method: string;
  note: string | null;
  created_at: string;
  customers: {
    name: string;
  } | null;
  pallet_types: {
    name: string;
  } | null;
  users_profiles: {
    full_name: string;
  } | null;
};

type ChangeRequest = {
  id: string;
  request_type: string;
  record_id: string;
  requested_by: string;
  requested_by_name: string | null;
  reason: string;
  old_data: any;
  new_data: any;
  status: string;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
};

type RequestMode = 'edit' | 'delete';

export default function ListaProdajePage() {
  const router = useRouter();

  const [sales, setSales] = useState<Sale[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [canViewSalePrices, setCanViewSalePrices] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [palletFilter, setPalletFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');

  const [requestMode, setRequestMode] = useState<RequestMode | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [requestReason, setRequestReason] = useState('');
  const [requestSaving, setRequestSaving] = useState(false);

  const [editQuantity, setEditQuantity] = useState('');
  const [editSaleDate, setEditSaleDate] = useState('');
  const [editDeliveryDate, setEditDeliveryDate] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editSalePrice, setEditSalePrice] = useState('');
  const [editPaymentStatus, setEditPaymentStatus] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('');

  async function loadData() {
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

    setCurrentUserId(user.id);

    const { data: profileData, error: profileError } = await supabase
      .from('users_profiles')
      .select('full_name, email, can_view_sale_prices, active')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      setErrorMessage(profileError.message);
      setLoading(false);
      return;
    }

    if (!profileData?.active) {
      await supabase.auth.signOut();
      router.push('/login');
      return;
    }

    setCurrentUserName(
      profileData?.full_name || profileData?.email || user.email || 'Korisnik'
    );
    setCanViewSalePrices(Boolean(profileData?.can_view_sale_prices));

    const { data, error } = await supabase
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
        created_at,
        customers (
          name
        ),
        pallet_types (
          name
        ),
        users_profiles (
          full_name
        )
      `)
      .or('deleted.is.null,deleted.eq.false')
      .order('sale_date', { ascending: false });

    if (error) {
      setErrorMessage(error.message);
    }

    if (data) {
      setSales(data as unknown as Sale[]);
    }

    await loadChangeRequests();

    setLoading(false);
  }

  async function loadChangeRequests() {
    const { data, error } = await supabase
      .from('change_requests')
      .select(`
        id,
        request_type,
        record_id,
        requested_by,
        requested_by_name,
        reason,
        old_data,
        new_data,
        status,
        reviewed_by,
        reviewed_by_name,
        reviewed_at,
        review_note,
        created_at
      `)
      .in('request_type', ['edit_sale', 'delete_sale'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setChangeRequests((data as ChangeRequest[]) || []);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  function getRequestForSale(saleId: string) {
    return changeRequests.find(
      (request) =>
        request.record_id === saleId &&
        (request.request_type === 'edit_sale' ||
          request.request_type === 'delete_sale')
    );
  }

  function openEditRequest(sale: Sale) {
    const existingRequest = getRequestForSale(sale.id);

    if (existingRequest) {
      setErrorMessage('Za ovu prodaju već postoji zahtev. Ne može se poslati novi zahtev.');
      return;
    }

    setSelectedSale(sale);
    setRequestMode('edit');
    setRequestReason('');

    setEditQuantity(String(sale.quantity));
    setEditSaleDate(sale.sale_date);
    setEditDeliveryDate(sale.delivery_date || '');
    setEditNote(sale.note || '');

    setEditSalePrice(String(sale.sale_price));
    setEditPaymentStatus(sale.payment_status);
    setEditPaymentMethod(sale.payment_method);

    setErrorMessage('');
    setSuccessMessage('');
  }

  function openDeleteRequest(sale: Sale) {
    const existingRequest = getRequestForSale(sale.id);

    if (existingRequest) {
      setErrorMessage('Za ovu prodaju već postoji zahtev. Ne može se poslati novi zahtev.');
      return;
    }

    setSelectedSale(sale);
    setRequestMode('delete');
    setRequestReason('');
    setErrorMessage('');
    setSuccessMessage('');
  }

  function closeRequestBox() {
    setSelectedSale(null);
    setRequestMode(null);
    setRequestReason('');
    setRequestSaving(false);
  }

  async function submitChangeRequest() {
    if (!selectedSale || !requestMode) return;

    setErrorMessage('');
    setSuccessMessage('');

    await loadChangeRequests();

    const existingRequest = changeRequests.find(
      (request) =>
        request.record_id === selectedSale.id &&
        (request.request_type === 'edit_sale' ||
          request.request_type === 'delete_sale')
    );

    if (existingRequest) {
      setErrorMessage('Za ovu prodaju već postoji zahtev. Ne može se poslati novi zahtev.');
      closeRequestBox();
      return;
    }

    if (!requestReason.trim()) {
      setErrorMessage('Moraš uneti razlog zahteva.');
      return;
    }

    setRequestSaving(true);

    const oldData = {
      id: selectedSale.id,
      quantity: selectedSale.quantity,
      sale_price: selectedSale.sale_price,
      total_amount: selectedSale.total_amount,
      sale_date: selectedSale.sale_date,
      delivery_date: selectedSale.delivery_date,
      payment_status: selectedSale.payment_status,
      payment_method: selectedSale.payment_method,
      note: selectedSale.note,
      customer_name: selectedSale.customers?.name || null,
      pallet_type_name: selectedSale.pallet_types?.name || null,
    };

    let newData = null;

    if (requestMode === 'edit') {
      const newQuantity = Number(editQuantity);
      const newPrice = Number(editSalePrice);

      if (!editQuantity || Number.isNaN(newQuantity) || newQuantity <= 0) {
        setRequestSaving(false);
        setErrorMessage('Količina mora biti veća od nule.');
        return;
      }

      if (!editSaleDate) {
        setRequestSaving(false);
        setErrorMessage('Datum prodaje je obavezan.');
        return;
      }

      if (canViewSalePrices) {
        if (!editSalePrice || Number.isNaN(newPrice) || newPrice < 0) {
          setRequestSaving(false);
          setErrorMessage('Cena mora biti ispravno uneta.');
          return;
        }

        newData = {
          quantity: newQuantity,
          sale_date: editSaleDate,
          delivery_date: editDeliveryDate || null,
          note: editNote.trim() || null,
          sale_price: newPrice,
          total_amount: newQuantity * newPrice,
          payment_status: editPaymentStatus,
          payment_method: editPaymentMethod,
        };
      } else {
        newData = {
          quantity: newQuantity,
          sale_date: editSaleDate,
          delivery_date: editDeliveryDate || null,
          note: editNote.trim() || null,
        };
      }
    }

    const { error } = await supabase.from('change_requests').insert({
      request_type: requestMode === 'edit' ? 'edit_sale' : 'delete_sale',
      record_id: selectedSale.id,
      requested_by: currentUserId,
      requested_by_name: currentUserName,
      reason: requestReason.trim(),
      old_data: oldData,
      new_data: newData,
      status: 'pending',
    });

    setRequestSaving(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage(
      requestMode === 'edit'
        ? 'Zahtev za izmenu je poslat adminu.'
        : 'Zahtev za brisanje je poslat adminu.'
    );

    closeRequestBox();
    await loadChangeRequests();
  }

  function paymentStatusText(status: string) {
    if (status === 'paid') return 'Plaćeno';
    if (status === 'unpaid') return 'Nije plaćeno';
    if (status === 'partial') return 'Delimično';
    return status;
  }

  function paymentMethodText(method: string) {
    if (method === 'cash') return 'Gotovina';
    if (method === 'bank') return 'Račun';
    if (method === 'other') return 'Ostalo';
    return method;
  }

  function requestTypeText(type: string) {
    if (type === 'edit_sale') return 'Izmena prodaje';
    if (type === 'delete_sale') return 'Brisanje prodaje';
    return type;
  }

  function requestStatusText(status: string) {
    if (status === 'pending') return 'Na čekanju';
    if (status === 'approved') return 'Odobreno';
    if (status === 'rejected') return 'Odbijeno';
    return status;
  }

  function requestStatusClass(status: string) {
    if (status === 'approved') {
      return 'bg-green-50 text-green-800 border border-green-200';
    }

    if (status === 'rejected') {
      return 'bg-red-50 text-red-800 border border-red-200';
    }

    return 'bg-yellow-50 text-yellow-800 border border-yellow-200';
  }

  function formatRsd(value: number) {
    return new Intl.NumberFormat('sr-RS').format(value) + ' RSD';
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

  useEffect(() => {
    loadData();
  }, []);

  const palletOptions = useMemo(() => {
    const names = sales
      .map((item) => item.pallet_types?.name)
      .filter((name): name is string => Boolean(name));

    return Array.from(new Set(names)).sort();
  }, [sales]);

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const customerName = sale.customers?.name?.toLowerCase() || '';
      const palletName = sale.pallet_types?.name || '';
      const search = searchTerm.toLowerCase().trim();

      const matchesSearch =
        !search ||
        customerName.includes(search) ||
        palletName.toLowerCase().includes(search) ||
        String(sale.quantity).includes(search) ||
        (sale.note || '').toLowerCase().includes(search);

      const matchesDateFrom = !dateFrom || sale.sale_date >= dateFrom;
      const matchesDateTo = !dateTo || sale.sale_date <= dateTo;
      const matchesPallet = !palletFilter || palletName === palletFilter;

      const matchesPaymentStatus =
        !paymentStatusFilter || sale.payment_status === paymentStatusFilter;

      const matchesPaymentMethod =
        !paymentMethodFilter || sale.payment_method === paymentMethodFilter;

      if (canViewSalePrices) {
        return (
          matchesSearch &&
          matchesDateFrom &&
          matchesDateTo &&
          matchesPallet &&
          matchesPaymentStatus &&
          matchesPaymentMethod
        );
      }

      return matchesSearch && matchesDateFrom && matchesDateTo && matchesPallet;
    });
  }, [
    sales,
    searchTerm,
    dateFrom,
    dateTo,
    palletFilter,
    paymentStatusFilter,
    paymentMethodFilter,
    canViewSalePrices,
  ]);

  const totalQuantity = filteredSales.reduce(
    (sum, item) => sum + Number(item.quantity),
    0
  );

  const totalValue = filteredSales.reduce(
    (sum, item) => sum + Number(item.total_amount),
    0
  );

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
          <p className="text-sm text-green-100">Lista prodaje</p>
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

        <Link className="bg-green-800 text-white px-4 py-2 rounded-xl" href="/lista-prodaje">
          Lista prodaje
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

        <div
          className={
            canViewSalePrices
              ? 'grid md:grid-cols-2 gap-4 mb-6'
              : 'grid md:grid-cols-1 gap-4 mb-6'
          }
        >
          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-600 text-sm">Ukupno prodato / filtrirano</p>
            <p className="text-3xl font-bold text-green-800 mt-2">
              {totalQuantity} kom
            </p>
          </div>

          {canViewSalePrices ? (
            <div className="bg-white rounded-2xl shadow p-5">
              <p className="text-gray-600 text-sm">Ukupna vrednost prodaje / filtrirano</p>
              <p className="text-3xl font-bold text-green-800 mt-2">
                {formatRsd(totalValue)}
              </p>
            </div>
          ) : null}
        </div>

        <div className="bg-white rounded-2xl shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-green-800 mb-4">
            Pretraga i filteri
          </h2>

          <div
            className={
              canViewSalePrices
                ? 'grid md:grid-cols-6 gap-4'
                : 'grid md:grid-cols-4 gap-4'
            }
          >
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Pretraga
              </label>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Kupac, paleta, količina..."
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
                Vrsta palete
              </label>
              <select
                value={palletFilter}
                onChange={(event) => setPalletFilter(event.target.value)}
                className="w-full border rounded-xl px-3 py-2"
              >
                <option value="">Sve palete</option>
                {palletOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {canViewSalePrices ? (
              <>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Plaćanje
                  </label>
                  <select
                    value={paymentStatusFilter}
                    onChange={(event) => setPaymentStatusFilter(event.target.value)}
                    className="w-full border rounded-xl px-3 py-2"
                  >
                    <option value="">Svi statusi</option>
                    <option value="paid">Plaćeno</option>
                    <option value="unpaid">Nije plaćeno</option>
                    <option value="partial">Delimično</option>
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
              </>
            ) : null}
          </div>

          <button
            onClick={() => {
              setSearchTerm('');
              setDateFrom('');
              setDateTo('');
              setPalletFilter('');
              setPaymentStatusFilter('');
              setPaymentMethodFilter('');
            }}
            className="mt-4 bg-gray-100 px-4 py-2 rounded-xl font-semibold"
          >
            Poništi filtere
          </button>
        </div>

        {selectedSale && requestMode ? (
          <div className="bg-white rounded-2xl shadow p-6 mb-6 border border-green-100">
            <h2 className="text-xl font-bold text-green-800 mb-2">
              {requestMode === 'edit'
                ? 'Zahtev za izmenu prodaje'
                : 'Zahtev za brisanje prodaje'}
            </h2>

            <p className="text-sm text-gray-600 mb-4">
              Prodaja: {formatDate(selectedSale.sale_date)} /{' '}
              {selectedSale.customers?.name || '-'} /{' '}
              {selectedSale.pallet_types?.name || '-'} /{' '}
              {selectedSale.quantity} kom
            </p>

            {requestMode === 'edit' ? (
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Nova količina
                  </label>
                  <input
                    type="number"
                    value={editQuantity}
                    onChange={(event) => setEditQuantity(event.target.value)}
                    className="w-full border rounded-xl px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Novi datum prodaje
                  </label>
                  <input
                    type="date"
                    value={editSaleDate}
                    onChange={(event) => setEditSaleDate(event.target.value)}
                    className="w-full border rounded-xl px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Novi datum isporuke
                  </label>
                  <input
                    type="date"
                    value={editDeliveryDate}
                    onChange={(event) => setEditDeliveryDate(event.target.value)}
                    className="w-full border rounded-xl px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Nova napomena
                  </label>
                  <input
                    value={editNote}
                    onChange={(event) => setEditNote(event.target.value)}
                    className="w-full border rounded-xl px-3 py-2"
                  />
                </div>

                {canViewSalePrices ? (
                  <>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Nova cena/kom
                      </label>
                      <input
                        type="number"
                        value={editSalePrice}
                        onChange={(event) => setEditSalePrice(event.target.value)}
                        className="w-full border rounded-xl px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Status plaćanja
                      </label>
                      <select
                        value={editPaymentStatus}
                        onChange={(event) => setEditPaymentStatus(event.target.value)}
                        className="w-full border rounded-xl px-3 py-2"
                      >
                        <option value="paid">Plaćeno</option>
                        <option value="unpaid">Nije plaćeno</option>
                        <option value="partial">Delimično</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Način plaćanja
                      </label>
                      <select
                        value={editPaymentMethod}
                        onChange={(event) => setEditPaymentMethod(event.target.value)}
                        className="w-full border rounded-xl px-3 py-2"
                      >
                        <option value="cash">Gotovina</option>
                        <option value="bank">Račun</option>
                        <option value="other">Ostalo</option>
                      </select>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Razlog zahteva obavezno
              </label>
              <textarea
                value={requestReason}
                onChange={(event) => setRequestReason(event.target.value)}
                placeholder="Npr. pogrešno uneta količina, dupliran unos, pogrešan datum..."
                className="w-full border rounded-xl px-3 py-2 min-h-[100px]"
              />
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={submitChangeRequest}
                disabled={requestSaving}
                className="bg-green-800 text-white px-4 py-2 rounded-xl font-semibold disabled:opacity-60"
              >
                {requestSaving ? 'Slanje...' : 'Pošalji zahtev adminu'}
              </button>

              <button
                onClick={closeRequestBox}
                className="bg-gray-100 px-4 py-2 rounded-xl font-semibold"
              >
                Otkaži
              </button>
            </div>
          </div>
        ) : null}

        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-2xl font-bold text-green-800">Sve prodaje</h2>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-3">Datum prodaje</th>
                  <th className="p-3">Datum isporuke</th>
                  <th className="p-3">Kupac</th>
                  <th className="p-3">Vrsta palete</th>
                  <th className="p-3">Količina</th>

                  {canViewSalePrices ? (
                    <>
                      <th className="p-3">Cena/kom</th>
                      <th className="p-3">Ukupno</th>
                      <th className="p-3">Plaćanje</th>
                      <th className="p-3">Način</th>
                    </>
                  ) : null}

                  <th className="p-3">Uneo</th>
                  <th className="p-3">Napomena</th>
                  <th className="p-3">Zahtev</th>
                </tr>
              </thead>

              <tbody>
                {filteredSales.map((sale) => {
                  const request = getRequestForSale(sale.id);

                  return (
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

                      {canViewSalePrices ? (
                        <>
                          <td className="p-3">
                            {formatRsd(Number(sale.sale_price))}
                          </td>

                          <td className="p-3 font-semibold">
                            {formatRsd(Number(sale.total_amount))}
                          </td>

                          <td className="p-3">
                            {paymentStatusText(sale.payment_status)}
                          </td>

                          <td className="p-3">
                            {paymentMethodText(sale.payment_method)}
                          </td>
                        </>
                      ) : null}

                      <td className="p-3">
                        {sale.users_profiles?.full_name || '-'}
                      </td>

                      <td className="p-3">{sale.note || '-'}</td>

                      <td className="p-3 min-w-[280px]">
                        {request ? (
                          <div
                            className={`px-3 py-2 rounded-xl text-xs font-semibold ${requestStatusClass(
                              request.status
                            )}`}
                          >
                            <p>
                              <span className="font-bold">
                                {requestStatusText(request.status)}
                              </span>{' '}
                              / {requestTypeText(request.request_type)}
                            </p>

                            <p className="mt-1">
                              Tražio: {request.requested_by_name || 'Nepoznat korisnik'}
                            </p>

                            <p className="mt-1">
                              Datum zahteva: {formatDateTime(request.created_at)}
                            </p>

                            <p className="mt-1">
                              Razlog: {request.reason || '-'}
                            </p>

                            {request.status !== 'pending' ? (
                              <>
                                <p className="mt-1">
                                  Rešio: {request.reviewed_by_name || 'Admin'}
                                </p>

                                <p className="mt-1">
                                  Datum rešenja: {formatDateTime(request.reviewed_at)}
                                </p>
                              </>
                            ) : null}

                            {request.review_note ? (
                              <p className="mt-1">
                                Napomena admina: {request.review_note}
                              </p>
                            ) : null}

                            <p className="mt-2 text-[11px] opacity-80">
                              Novi zahtev za ovu prodaju nije moguć.
                            </p>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => openEditRequest(sale)}
                              className="bg-yellow-100 text-yellow-900 px-3 py-2 rounded-xl text-xs font-semibold"
                            >
                              Zahtev za izmenu
                            </button>

                            <button
                              onClick={() => openDeleteRequest(sale)}
                              className="bg-red-100 text-red-800 px-3 py-2 rounded-xl text-xs font-semibold"
                            >
                              Zahtev za brisanje
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredSales.length === 0 ? (
              <p className="text-gray-500 mt-4">
                Nema prodaja za izabrane filtere.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}