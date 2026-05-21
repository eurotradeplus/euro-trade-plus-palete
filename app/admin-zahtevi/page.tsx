'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabaseUrl = 'https://cqwiblmohdjehbeifnko.supabase.co';
const supabaseKey = 'sb_publishable_S8mQrQ5iL8F1ZmO1zjqQfg_ePTqKSZf';

const supabase = createClient(supabaseUrl, supabaseKey);

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

export default function AdminZahteviPage() {
  const router = useRouter();

  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

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
      .select('full_name, email, can_approve_changes, active')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      alert('Greška pri proveri dozvole: ' + profileError.message);
      router.push('/dashboard');
      return;
    }

    if (!profileData?.active || !profileData?.can_approve_changes) {
      alert('Nemate dozvolu za admin zahteve.');
      router.push('/dashboard');
      return;
    }

    setCurrentUserName(
      profileData.full_name || profileData.email || user.email || 'Admin'
    );

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
      .in('request_type', [
        'edit_purchase',
        'delete_purchase',
        'edit_sale',
        'delete_sale',
      ])
      .order('created_at', { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setRequests((data || []) as ChangeRequest[]);
    setLoading(false);
  }

  async function approveRequest(request: ChangeRequest) {
    setSavingId(request.id);
    setErrorMessage('');
    setSuccessMessage('');

    const now = new Date().toISOString();

    if (request.status !== 'pending') {
      setSavingId('');
      setErrorMessage('Ovaj zahtev je već obrađen.');
      return;
    }

    if (!request.record_id) {
      setSavingId('');
      setErrorMessage('Zahtev nema record_id i ne može biti obrađen.');
      return;
    }

    if (request.request_type === 'edit_purchase') {
      if (!request.new_data) {
        setSavingId('');
        setErrorMessage('Zahtev nema nove podatke za izmenu.');
        return;
      }

      const { error: updateError } = await supabase
        .from('purchases')
        .update(request.new_data)
        .eq('id', request.record_id);

      if (updateError) {
        setSavingId('');
        setErrorMessage(updateError.message);
        return;
      }
    }

    if (request.request_type === 'delete_purchase') {
      const { error: deleteError } = await supabase
        .from('purchases')
        .update({
          deleted: true,
          deleted_at: now,
          deleted_by: currentUserId,
          deleted_reason: request.reason,
        })
        .eq('id', request.record_id);

      if (deleteError) {
        setSavingId('');
        setErrorMessage(deleteError.message);
        return;
      }
    }

    if (request.request_type === 'edit_sale') {
      if (!request.new_data) {
        setSavingId('');
        setErrorMessage('Zahtev nema nove podatke za izmenu.');
        return;
      }

      const { error: updateError } = await supabase
        .from('sales')
        .update(request.new_data)
        .eq('id', request.record_id);

      if (updateError) {
        setSavingId('');
        setErrorMessage(updateError.message);
        return;
      }
    }

    if (request.request_type === 'delete_sale') {
      const { error: deleteError } = await supabase
        .from('sales')
        .update({
          deleted: true,
          deleted_at: now,
          deleted_by: currentUserId,
          deleted_reason: request.reason,
        })
        .eq('id', request.record_id);

      if (deleteError) {
        setSavingId('');
        setErrorMessage(deleteError.message);
        return;
      }
    }

    const { error: requestError } = await supabase
      .from('change_requests')
      .update({
        status: 'approved',
        reviewed_by: currentUserId,
        reviewed_by_name: currentUserName,
        reviewed_at: now,
        review_note: 'Odobreno',
      })
      .eq('id', request.id)
      .eq('status', 'pending');

    setSavingId('');

    if (requestError) {
      setErrorMessage(requestError.message);
      return;
    }

    setSuccessMessage('Zahtev je odobren i trajno evidentiran.');
    await loadData();
  }

  async function rejectRequest(request: ChangeRequest) {
    const note = window.prompt('Unesi razlog odbijanja:');

    if (!note || !note.trim()) {
      setErrorMessage('Moraš uneti razlog odbijanja.');
      return;
    }

    setSavingId(request.id);
    setErrorMessage('');
    setSuccessMessage('');

    if (request.status !== 'pending') {
      setSavingId('');
      setErrorMessage('Ovaj zahtev je već obrađen.');
      return;
    }

    const { error } = await supabase
      .from('change_requests')
      .update({
        status: 'rejected',
        reviewed_by: currentUserId,
        reviewed_by_name: currentUserName,
        reviewed_at: new Date().toISOString(),
        review_note: note.trim(),
      })
      .eq('id', request.id)
      .eq('status', 'pending');

    setSavingId('');

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage('Zahtev je odbijen i trajno evidentiran.');
    await loadData();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  function requestTypeText(type: string) {
    if (type === 'edit_purchase') return 'Izmena otkupa';
    if (type === 'delete_purchase') return 'Brisanje otkupa';
    if (type === 'edit_sale') return 'Izmena prodaje';
    if (type === 'delete_sale') return 'Brisanje prodaje';
    return type;
  }

  function statusText(status: string) {
    if (status === 'pending') return 'Na čekanju';
    if (status === 'approved') return 'Odobreno';
    if (status === 'rejected') return 'Odbijeno';
    return status;
  }

  function statusClass(status: string) {
    if (status === 'approved') {
      return 'bg-green-100 text-green-800 border border-green-200';
    }

    if (status === 'rejected') {
      return 'bg-red-100 text-red-800 border border-red-200';
    }

    return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
  }

  function paymentStatusText(status: string) {
    if (status === 'paid') return 'Plaćeno';
    if (status === 'unpaid') return 'Nije plaćeno';
    if (status === 'partial') return 'Delimično';
    return status || '-';
  }

  function paymentMethodText(method: string) {
    if (method === 'cash') return 'Gotovina';
    if (method === 'bank') return 'Račun';
    if (method === 'other') return 'Ostalo';
    return method || '-';
  }

  function formatDate(value: string | null) {
    if (!value) return '-';

    const onlyDate = value.split('T')[0];
    const parts = onlyDate.split('-');

    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}.`;
    }

    return value;
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

  function formatRsd(value: number | null | undefined) {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('sr-RS').format(Number(value)) + ' RSD';
  }

  function formatOldData(data: any) {
    if (!data) return '-';

    return (
      <div className="space-y-1">
        <p>
          <b>Datum:</b> {formatDate(data.purchase_date || data.sale_date || null)}
        </p>

        {data.delivery_date !== undefined ? (
          <p>
            <b>Datum isporuke:</b> {formatDate(data.delivery_date)}
          </p>
        ) : null}

        <p>
          <b>Partner:</b> {data.supplier_name || data.customer_name || '-'}
        </p>

        <p>
          <b>Paleta:</b> {data.pallet_type_name || '-'}
        </p>

        <p>
          <b>Količina:</b> {data.quantity || '-'}
        </p>

        {data.purchase_price !== undefined ? (
          <p>
            <b>Cena:</b> {formatRsd(data.purchase_price)}
          </p>
        ) : null}

        {data.sale_price !== undefined ? (
          <p>
            <b>Cena:</b> {formatRsd(data.sale_price)}
          </p>
        ) : null}

        {data.total_amount !== undefined ? (
          <p>
            <b>Ukupno:</b> {formatRsd(data.total_amount)}
          </p>
        ) : null}

        {data.payment_status !== undefined ? (
          <p>
            <b>Status plaćanja:</b> {paymentStatusText(data.payment_status)}
          </p>
        ) : null}

        {data.payment_method !== undefined ? (
          <p>
            <b>Način plaćanja:</b> {paymentMethodText(data.payment_method)}
          </p>
        ) : null}

        <p>
          <b>Napomena:</b> {data.note || '-'}
        </p>
      </div>
    );
  }

  function formatNewData(data: any) {
    if (!data) return <p>-</p>;

    return (
      <div className="space-y-1">
        {data.purchase_date !== undefined ? (
          <p>
            <b>Novi datum:</b> {formatDate(data.purchase_date)}
          </p>
        ) : null}

        {data.sale_date !== undefined ? (
          <p>
            <b>Novi datum prodaje:</b> {formatDate(data.sale_date)}
          </p>
        ) : null}

        {data.delivery_date !== undefined ? (
          <p>
            <b>Novi datum isporuke:</b> {formatDate(data.delivery_date)}
          </p>
        ) : null}

        {data.quantity !== undefined ? (
          <p>
            <b>Nova količina:</b> {data.quantity}
          </p>
        ) : null}

        {data.purchase_price !== undefined ? (
          <p>
            <b>Nova cena:</b> {formatRsd(data.purchase_price)}
          </p>
        ) : null}

        {data.sale_price !== undefined ? (
          <p>
            <b>Nova cena:</b> {formatRsd(data.sale_price)}
          </p>
        ) : null}

        {data.total_amount !== undefined ? (
          <p>
            <b>Novo ukupno:</b> {formatRsd(data.total_amount)}
          </p>
        ) : null}

        {data.payment_status !== undefined ? (
          <p>
            <b>Status plaćanja:</b> {paymentStatusText(data.payment_status)}
          </p>
        ) : null}

        {data.payment_method !== undefined ? (
          <p>
            <b>Način plaćanja:</b> {paymentMethodText(data.payment_method)}
          </p>
        ) : null}

        {data.note !== undefined ? (
          <p>
            <b>Nova napomena:</b> {data.note || '-'}
          </p>
        ) : null}
      </div>
    );
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredRequests = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();

    return requests.filter((request) => {
      const matchesSearch =
        !search ||
        requestTypeText(request.request_type).toLowerCase().includes(search) ||
        statusText(request.status).toLowerCase().includes(search) ||
        (request.requested_by_name || '').toLowerCase().includes(search) ||
        (request.reviewed_by_name || '').toLowerCase().includes(search) ||
        (request.reason || '').toLowerCase().includes(search) ||
        (request.review_note || '').toLowerCase().includes(search) ||
        (request.old_data?.supplier_name || '').toLowerCase().includes(search) ||
        (request.old_data?.customer_name || '').toLowerCase().includes(search) ||
        (request.old_data?.pallet_type_name || '').toLowerCase().includes(search);

      const matchesStatus = !statusFilter || request.status === statusFilter;
      const matchesType = !typeFilter || request.request_type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [requests, searchTerm, statusFilter, typeFilter]);

  const pendingRequests = filteredRequests.filter((item) => item.status === 'pending');
  const reviewedRequests = filteredRequests.filter((item) => item.status !== 'pending');

  const allPendingCount = requests.filter((item) => item.status === 'pending').length;
  const allReviewedCount = requests.filter((item) => item.status !== 'pending').length;

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
          <p className="text-sm text-green-100">Admin zahtevi</p>
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

        <Link className="bg-gray-100 px-4 py-2 rounded-xl" href="/lista-otkupa">
          Lista otkupa
        </Link>

        <Link className="bg-gray-100 px-4 py-2 rounded-xl" href="/lista-prodaje">
          Lista prodaje
        </Link>

        <Link className="bg-green-800 text-white px-4 py-2 rounded-xl" href="/admin-zahtevi">
          Admin zahtevi
        </Link>

        <Link className="bg-gray-100 px-4 py-2 rounded-xl" href="/admin-korisnici">
          Admin korisnici
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
            <p className="text-gray-600 text-sm">Zahtevi na čekanju</p>
            <p className="text-3xl font-bold text-yellow-700 mt-2">
              {allPendingCount}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-600 text-sm">Obrađeni zahtevi</p>
            <p className="text-3xl font-bold text-green-800 mt-2">
              {allReviewedCount}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-600 text-sm">Ukupno zahteva</p>
            <p className="text-3xl font-bold text-green-800 mt-2">
              {requests.length}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-green-800 mb-4">
            Pretraga i filteri
          </h2>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Pretraga
              </label>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Ime, razlog, partner, paleta..."
                className="w-full border rounded-xl px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full border rounded-xl px-3 py-2"
              >
                <option value="">Svi statusi</option>
                <option value="pending">Na čekanju</option>
                <option value="approved">Odobreno</option>
                <option value="rejected">Odbijeno</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Tip zahteva
              </label>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="w-full border rounded-xl px-3 py-2"
              >
                <option value="">Svi tipovi</option>
                <option value="edit_purchase">Izmena otkupa</option>
                <option value="delete_purchase">Brisanje otkupa</option>
                <option value="edit_sale">Izmena prodaje</option>
                <option value="delete_sale">Brisanje prodaje</option>
              </select>
            </div>
          </div>

          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('');
              setTypeFilter('');
            }}
            className="mt-4 bg-gray-100 px-4 py-2 rounded-xl font-semibold"
          >
            Poništi filtere
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow p-6 mb-6">
          <h2 className="text-2xl font-bold text-green-800">
            Zahtevi na čekanju
          </h2>

          <div className="mt-5 space-y-4">
            {pendingRequests.map((request) => (
              <div key={request.id} className="border rounded-2xl p-4">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="font-bold text-lg">
                      {requestTypeText(request.request_type)}
                    </p>

                    <p className="text-sm text-gray-600">
                      Poslao: <b>{request.requested_by_name || '-'}</b>
                    </p>

                    <p className="text-sm text-gray-600">
                      Datum zahteva: {formatDateTime(request.created_at)}
                    </p>

                    <p className="text-sm text-gray-600">
                      Status:{' '}
                      <span
                        className={`inline-block px-2 py-1 rounded-lg text-xs font-bold ${statusClass(
                          request.status
                        )}`}
                      >
                        {statusText(request.status)}
                      </span>
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => approveRequest(request)}
                      disabled={savingId === request.id}
                      className="bg-green-800 text-white px-4 py-2 rounded-xl font-semibold disabled:opacity-60"
                    >
                      {savingId === request.id ? 'Obrada...' : 'Odobri'}
                    </button>

                    <button
                      onClick={() => rejectRequest(request)}
                      disabled={savingId === request.id}
                      className="bg-red-100 text-red-800 px-4 py-2 rounded-xl font-semibold disabled:opacity-60"
                    >
                      Odbij
                    </button>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4 mt-4 text-sm">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="font-bold mb-2">Razlog</p>
                    <p>{request.reason}</p>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="font-bold mb-2">Staro stanje</p>
                    {formatOldData(request.old_data)}
                  </div>

                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="font-bold mb-2">
                      {request.new_data ? 'Novo stanje' : 'Novo stanje / brisanje'}
                    </p>
                    {formatNewData(request.new_data)}
                  </div>
                </div>
              </div>
            ))}

            {pendingRequests.length === 0 ? (
              <p className="text-gray-500">
                Nema zahteva na čekanju za izabrane filtere.
              </p>
            ) : null}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-2xl font-bold text-green-800">
            Obrađeni zahtevi
          </h2>

          <div className="mt-5 space-y-4">
            {reviewedRequests.map((request) => (
              <div key={request.id} className="border rounded-2xl p-4 bg-gray-50">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="font-bold">
                      {requestTypeText(request.request_type)} —{' '}
                      <span
                        className={`inline-block px-2 py-1 rounded-lg text-xs font-bold ${statusClass(
                          request.status
                        )}`}
                      >
                        {statusText(request.status)}
                      </span>
                    </p>

                    <p className="text-sm text-gray-600 mt-1">
                      Poslao: <b>{request.requested_by_name || '-'}</b> /{' '}
                      {formatDateTime(request.created_at)}
                    </p>

                    <p className="text-sm text-gray-600">
                      Obradio: <b>{request.reviewed_by_name || '-'}</b> /{' '}
                      {formatDateTime(request.reviewed_at)}
                    </p>
                  </div>
                </div>

                <p className="text-sm mt-3">
                  <b>Razlog zahteva:</b> {request.reason}
                </p>

                <p className="text-sm">
                  <b>Napomena admina:</b> {request.review_note || '-'}
                </p>

                <div className="grid md:grid-cols-2 gap-4 mt-4 text-sm">
                  <div className="bg-white rounded-xl p-3">
                    <p className="font-bold mb-2">Staro stanje</p>
                    {formatOldData(request.old_data)}
                  </div>

                  <div className="bg-white rounded-xl p-3">
                    <p className="font-bold mb-2">
                      {request.new_data ? 'Novo stanje' : 'Novo stanje / brisanje'}
                    </p>
                    {formatNewData(request.new_data)}
                  </div>
                </div>
              </div>
            ))}

            {reviewedRequests.length === 0 ? (
              <p className="text-gray-500">
                Nema obrađenih zahteva za izabrane filtere.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}