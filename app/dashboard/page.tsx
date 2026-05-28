'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabaseUrl = 'https://cqwiblmohdjehbeifnko.supabase.co';
const supabaseKey = 'sb_publishable_S8mQrQ5iL8F1ZmO1zjqQfg_ePTqKSZf';

const supabase = createClient(supabaseUrl, supabaseKey);

type StockItem = {
  pallet_type_id: string;
  pallet_type_name: string;
  current_quantity: number;
};

type PurchaseRow = {
  id: string;
  quantity: number;
  total_amount: number;
  purchase_date: string;
  payment_status: string;
};

type SaleRow = {
  id: string;
  quantity: number;
  total_amount: number;
  sale_date: string;
  payment_status: string;
};

type ChangeRequest = {
  id: string;
  request_type: string;
  status: string;
  created_at: string;
};

export default function DashboardPage() {
  const router = useRouter();

  const [stock, setStock] = useState<StockItem[]>([]);
  const [todayPurchases, setTodayPurchases] = useState<PurchaseRow[]>([]);
  const [todaySales, setTodaySales] = useState<SaleRow[]>([]);
  const [purchaseDebts, setPurchaseDebts] = useState<PurchaseRow[]>([]);
  const [saleDebts, setSaleDebts] = useState<SaleRow[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ChangeRequest[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [fullName, setFullName] = useState('');
  const [canAdjustStock, setCanAdjustStock] = useState(false);
  const [canViewFinances, setCanViewFinances] = useState(false);
  const [canApproveChanges, setCanApproveChanges] = useState(false);
  const [canManageUsers, setCanManageUsers] = useState(false);

  async function loadData() {
    setLoading(true);
    setErrorMessage('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from('users_profiles')
      .select('full_name, email, active, can_approve_changes, can_manage_users')
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

    setFullName(profileData.full_name || profileData.email || user.email || 'Korisnik');
    setCanApproveChanges(Boolean(profileData.can_approve_changes));
    setCanManageUsers(Boolean(profileData.can_manage_users));

    const { data: permissionData, error: permissionError } = await supabase
      .from('user_permissions')
      .select('can_adjust_stock, can_view_finances')
      .eq('user_id', user.id)
      .maybeSingle();

    if (permissionError) {
      setErrorMessage(permissionError.message);
      setLoading(false);
      return;
    }

    const userCanAdjustStock = Boolean(permissionData?.can_adjust_stock);
    const userCanViewFinances = Boolean(permissionData?.can_view_finances);

    setCanAdjustStock(userCanAdjustStock);
    setCanViewFinances(userCanViewFinances);

    const today = new Date().toISOString().split('T')[0];

    const stockResult = await supabase
      .from('final_stock')
      .select('pallet_type_id, pallet_type_name, current_quantity')
      .order('pallet_type_name', { ascending: true });

    if (stockResult.error) {
      setErrorMessage(stockResult.error.message);
      setLoading(false);
      return;
    }

    setStock((stockResult.data || []) as StockItem[]);

    const purchasesResult = await supabase
      .from('purchases')
      .select('id, quantity, total_amount, purchase_date, payment_status')
      .eq('purchase_date', today)
      .or('deleted.is.null,deleted.eq.false');

    if (purchasesResult.error) {
      setErrorMessage(purchasesResult.error.message);
      setLoading(false);
      return;
    }

    setTodayPurchases((purchasesResult.data || []) as PurchaseRow[]);

    const salesResult = await supabase
      .from('sales')
      .select('id, quantity, total_amount, sale_date, payment_status')
      .eq('sale_date', today)
      .or('deleted.is.null,deleted.eq.false');

    if (salesResult.error) {
      setErrorMessage(salesResult.error.message);
      setLoading(false);
      return;
    }

    setTodaySales((salesResult.data || []) as SaleRow[]);

    if (userCanViewFinances) {
      const purchaseDebtsResult = await supabase
        .from('purchases')
        .select('id, quantity, total_amount, purchase_date, payment_status')
        .in('payment_status', ['unpaid', 'partial'])
        .or('deleted.is.null,deleted.eq.false');

      if (purchaseDebtsResult.error) {
        setErrorMessage(purchaseDebtsResult.error.message);
        setLoading(false);
        return;
      }

      setPurchaseDebts((purchaseDebtsResult.data || []) as PurchaseRow[]);

      const saleDebtsResult = await supabase
        .from('sales')
        .select('id, quantity, total_amount, sale_date, payment_status')
        .in('payment_status', ['unpaid', 'partial'])
        .or('deleted.is.null,deleted.eq.false');

      if (saleDebtsResult.error) {
        setErrorMessage(saleDebtsResult.error.message);
        setLoading(false);
        return;
      }

      setSaleDebts((saleDebtsResult.data || []) as SaleRow[]);
    }

    if (Boolean(profileData.can_approve_changes)) {
      const requestsResult = await supabase
        .from('change_requests')
        .select('id, request_type, status, created_at')
        .eq('status', 'pending')
        .in('request_type', [
          'edit_purchase',
          'delete_purchase',
          'edit_sale',
          'delete_sale',
        ])
        .order('created_at', { ascending: false });

      if (requestsResult.error) {
        setErrorMessage(requestsResult.error.message);
        setLoading(false);
        return;
      }

      setPendingRequests((requestsResult.data || []) as ChangeRequest[]);
    }

    setLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  function formatRsd(value: number) {
    return new Intl.NumberFormat('sr-RS').format(Number(value)) + ' RSD';
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

  function requestTypeText(type: string) {
    if (type === 'edit_purchase') return 'Izmena otkupa';
    if (type === 'delete_purchase') return 'Brisanje otkupa';
    if (type === 'edit_sale') return 'Izmena prodaje';
    if (type === 'delete_sale') return 'Brisanje prodaje';
    return type;
  }

  useEffect(() => {
    loadData();
  }, []);

  const totalStockQuantity = stock.reduce(
    (sum, item) => sum + Number(item.current_quantity),
    0
  );

  const lowStockItems = stock.filter((item) => Number(item.current_quantity) <= 0);

  const todayPurchasedQuantity = todayPurchases.reduce(
    (sum, item) => sum + Number(item.quantity),
    0
  );

  const todaySoldQuantity = todaySales.reduce(
    (sum, item) => sum + Number(item.quantity),
    0
  );

  const todayPurchaseValue = todayPurchases.reduce(
    (sum, item) => sum + Number(item.total_amount),
    0
  );

  const todaySaleValue = todaySales.reduce(
    (sum, item) => sum + Number(item.total_amount),
    0
  );

  const totalCustomerDebt = saleDebts.reduce(
    (sum, item) => sum + Number(item.total_amount),
    0
  );

  const totalSupplierDebt = purchaseDebts.reduce(
    (sum, item) => sum + Number(item.total_amount),
    0
  );

  const stockSorted = useMemo(() => {
    return [...stock].sort(
      (a, b) => Number(a.current_quantity) - Number(b.current_quantity)
    );
  }, [stock]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-700">Učitavanje...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="bg-green-900 text-white px-6 py-4 flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Euro Trade Plus</h1>
          <p className="text-sm text-green-100">Evidencija paleta</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm text-green-100">
            Prijavljen: <b>{fullName}</b>
          </p>

          <button
            onClick={logout}
            className="bg-white text-green-900 px-4 py-2 rounded-xl font-semibold"
          >
            Odjava
          </button>
        </div>
      </header>

      <nav className="bg-white border-b px-6 py-4 flex flex-wrap gap-3">
        <Link
          className="bg-green-800 text-white px-4 py-2 rounded-xl"
          href="/dashboard"
        >
          Dashboard
        </Link>

        <Link className="bg-gray-100 px-4 py-2 rounded-xl" href="/otkup">
          Novi otkup
        </Link>

        <Link className="bg-gray-100 px-4 py-2 rounded-xl" href="/prodaja">
          Nova prodaja
        </Link>

        <Link className="bg-orange-100 text-orange-900 px-4 py-2 rounded-xl font-semibold" href="/popravka-paleta">
          Popravka paleta
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

        {canViewFinances ? (
          <Link className="bg-gray-100 px-4 py-2 rounded-xl" href="/dugovanja">
            Dugovanja
          </Link>
        ) : null}

        {canViewFinances ? (
          <Link
            className="bg-blue-100 text-blue-900 px-4 py-2 rounded-xl font-semibold"
            href="/izvestaji"
          >
            Izveštaji
          </Link>
        ) : null}

        {canAdjustStock ? (
          <Link
            className="bg-yellow-100 text-yellow-900 px-4 py-2 rounded-xl font-semibold"
            href="/korekcija-lagera"
          >
            Korekcija lagera
          </Link>
        ) : null}

        {canApproveChanges ? (
          <Link
            className="bg-red-100 text-red-900 px-4 py-2 rounded-xl font-semibold"
            href="/admin-zahtevi"
          >
            Admin zahtevi
          </Link>
        ) : null}

        {canManageUsers ? (
          <Link
            className="bg-purple-100 text-purple-900 px-4 py-2 rounded-xl font-semibold"
            href="/admin-korisnici"
          >
            Admin korisnici
          </Link>
        ) : null}
      </nav>

      <section className="p-6">
        {errorMessage ? (
          <div className="mb-4 bg-red-50 text-red-700 px-4 py-3 rounded-xl">
            Greška: {errorMessage}
          </div>
        ) : null}

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-green-900">
            Dashboard
          </h2>
          <p className="text-gray-600 text-sm">
            Pregled lagera, današnjeg rada i najvažnijih upozorenja.
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-600 text-sm">Ukupno na lageru</p>
            <p className="text-3xl font-bold text-green-800 mt-2">
              {totalStockQuantity} kom
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-600 text-sm">Danas otkupljeno</p>
            <p className="text-3xl font-bold text-green-800 mt-2">
              {todayPurchasedQuantity} kom
            </p>

            {canViewFinances ? (
              <p className="text-sm text-gray-500 mt-1">
                {formatRsd(todayPurchaseValue)}
              </p>
            ) : null}
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-600 text-sm">Danas prodato</p>
            <p className="text-3xl font-bold text-green-800 mt-2">
              {todaySoldQuantity} kom
            </p>

            {canViewFinances ? (
              <p className="text-sm text-gray-500 mt-1">
                {formatRsd(todaySaleValue)}
              </p>
            ) : null}
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-600 text-sm">Palete na nuli/minusu</p>
            <p className="text-3xl font-bold text-red-700 mt-2">
              {lowStockItems.length}
            </p>
          </div>

          {canViewFinances ? (
            <>
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
            </>
          ) : null}

          {canApproveChanges ? (
            <div className="bg-white rounded-2xl shadow p-5">
              <p className="text-gray-600 text-sm">Zahtevi na čekanju</p>
              <p className="text-3xl font-bold text-yellow-700 mt-2">
                {pendingRequests.length}
              </p>

              <Link
                href="/admin-zahtevi"
                className="inline-block mt-3 bg-yellow-100 text-yellow-900 px-3 py-2 rounded-xl text-xs font-semibold"
              >
                Otvori zahteve
              </Link>
            </div>
          ) : null}
        </div>

        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Link
            href="/otkup"
            className="bg-green-800 text-white rounded-2xl shadow p-5 font-semibold"
          >
            + Novi otkup
            <p className="text-green-100 text-sm mt-1">
              Unos novih kupljenih paleta
            </p>
          </Link>

          <Link
            href="/prodaja"
            className="bg-green-800 text-white rounded-2xl shadow p-5 font-semibold"
          >
            + Nova prodaja
            <p className="text-green-100 text-sm mt-1">
              Unos nove prodaje kupcu
            </p>
          </Link>

          <Link
            href="/popravka-paleta"
            className="bg-orange-100 text-orange-900 rounded-2xl shadow p-5 font-semibold"
          >
            Popravka paleta
            <p className="text-orange-800 text-sm mt-1">
              Prebaci oštećene palete u ispravne
            </p>
          </Link>

          <Link
            href="/lista-otkupa"
            className="bg-white rounded-2xl shadow p-5 font-semibold text-green-900"
          >
            Lista otkupa
            <p className="text-gray-500 text-sm mt-1">
              Pregled i zahtevi za izmene
            </p>
          </Link>

          <Link
            href="/lista-prodaje"
            className="bg-white rounded-2xl shadow p-5 font-semibold text-green-900"
          >
            Lista prodaje
            <p className="text-gray-500 text-sm mt-1">
              Pregled i zahtevi za izmene
            </p>
          </Link>

          {canAdjustStock ? (
            <Link
              href="/korekcija-lagera"
              className="bg-yellow-100 text-yellow-900 rounded-2xl shadow p-5 font-semibold"
            >
              Korekcija lagera
              <p className="text-yellow-800 text-sm mt-1">
                Ručno povećanje ili smanjenje stanja
              </p>
            </Link>
          ) : null}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow p-6 lg:col-span-2">
            <h2 className="text-xl font-bold text-green-800 mb-4">
              Trenutno stanje paleta
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="p-3">Vrsta palete</th>
                    <th className="p-3">Stanje</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {stockSorted.map((item) => (
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

              {stockSorted.length === 0 ? (
                <p className="text-gray-500 mt-4">
                  Nema podataka o lageru.
                </p>
              ) : null}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-xl font-bold text-green-800 mb-4">
              Obaveštenja
            </h2>

            <div className="space-y-3">
              {lowStockItems.length > 0 ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800">
                  <p className="font-bold">Nula ili minus lager</p>
                  <p>
                    {lowStockItems.length} tipova paleta je na nuli ili u minusu.
                  </p>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">
                  <p className="font-bold">Lager je pozitivan</p>
                  <p>Sve vrste paleta imaju pozitivan lager.</p>
                </div>
              )}

              {canApproveChanges && pendingRequests.length > 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
                  <p className="font-bold">Zahtevi čekaju obradu</p>
                  <p>Ima {pendingRequests.length} zahteva za izmenu/brisanje.</p>
                </div>
              ) : null}

              {canViewFinances && totalCustomerDebt > 0 ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800">
                  <p className="font-bold">Dugovanja kupaca</p>
                  <p>Kupci trenutno duguju {formatRsd(totalCustomerDebt)}.</p>
                </div>
              ) : null}

              {canViewFinances && totalSupplierDebt > 0 ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800">
                  <p className="font-bold">Dugovanja prema dobavljačima</p>
                  <p>Firma trenutno duguje {formatRsd(totalSupplierDebt)}.</p>
                </div>
              ) : null}

              {canApproveChanges && pendingRequests.length > 0 ? (
                <div className="pt-2">
                  <p className="text-sm font-bold text-gray-700 mb-2">
                    Poslednji zahtevi
                  </p>

                  <div className="space-y-2">
                    {pendingRequests.slice(0, 5).map((request) => (
                      <div
                        key={request.id}
                        className="border rounded-xl p-3 text-xs"
                      >
                        <p className="font-semibold">
                          {requestTypeText(request.request_type)}
                        </p>
                        <p className="text-gray-500">
                          {formatDate(request.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}