'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabaseUrl = 'https://cqwiblmohdjehbeifnko.supabase.co';
const supabaseKey = 'sb_publishable_S8mQrQ5iL8F1ZmO1zjqQfg_ePTqKSZf';

const supabase = createClient(supabaseUrl, supabaseKey);

type Purchase = {
  id: string;
  quantity: number;
  total_amount: number;
  purchase_date: string;
  purchase_price: number;
  suppliers: {
    name: string;
  } | null;
  pallet_types: {
    name: string;
  } | null;
};

type Sale = {
  id: string;
  quantity: number;
  total_amount: number;
  sale_date: string;
  sale_price: number;
  customers: {
    name: string;
  } | null;
  pallet_types: {
    name: string;
  } | null;
};

type StockItem = {
  pallet_type_id: string;
  pallet_type_name: string;
  current_quantity: number;
};

type UserPermission = {
  can_view_finances: boolean | null;
};

export default function IzvestajiPage() {
  const router = useRouter();

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [canViewProfit, setCanViewProfit] = useState(false);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [palletFilter, setPalletFilter] = useState('');

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
      .select('active, can_view_profit')
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

    if (!Boolean((permissionData as UserPermission | null)?.can_view_finances)) {
      alert('Nemate dozvolu za izveštaje.');
      router.push('/dashboard');
      return;
    }

    setCanViewProfit(Boolean(profileData?.can_view_profit));

    const purchasesResult = await supabase
      .from('purchases')
      .select(`
        id,
        quantity,
        purchase_price,
        total_amount,
        purchase_date,
        suppliers (
          name
        ),
        pallet_types (
          name
        )
      `)
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
        customers (
          name
        ),
        pallet_types (
          name
        )
      `)
      .or('deleted.is.null,deleted.eq.false')
      .order('sale_date', { ascending: false });

    const stockResult = await supabase
      .from('final_stock')
      .select('*')
      .order('pallet_type_name', { ascending: true });

    if (purchasesResult.error) {
      setErrorMessage(purchasesResult.error.message);
    }

    if (salesResult.error) {
      setErrorMessage(salesResult.error.message);
    }

    if (stockResult.error) {
      setErrorMessage(stockResult.error.message);
    }

    if (purchasesResult.data) {
      setPurchases(purchasesResult.data as unknown as Purchase[]);
    }

    if (salesResult.data) {
      setSales(salesResult.data as unknown as Sale[]);
    }

    if (stockResult.data) {
      setStock(stockResult.data as StockItem[]);
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

  const palletOptions = useMemo(() => {
    const purchaseNames = purchases
      .map((item) => item.pallet_types?.name)
      .filter((name): name is string => Boolean(name));

    const saleNames = sales
      .map((item) => item.pallet_types?.name)
      .filter((name): name is string => Boolean(name));

    return Array.from(new Set([...purchaseNames, ...saleNames])).sort();
  }, [purchases, sales]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter((purchase) => {
      const palletName = purchase.pallet_types?.name || '';

      const matchesDateFrom = !dateFrom || purchase.purchase_date >= dateFrom;
      const matchesDateTo = !dateTo || purchase.purchase_date <= dateTo;
      const matchesPallet = !palletFilter || palletName === palletFilter;

      return matchesDateFrom && matchesDateTo && matchesPallet;
    });
  }, [purchases, dateFrom, dateTo, palletFilter]);

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const palletName = sale.pallet_types?.name || '';

      const matchesDateFrom = !dateFrom || sale.sale_date >= dateFrom;
      const matchesDateTo = !dateTo || sale.sale_date <= dateTo;
      const matchesPallet = !palletFilter || palletName === palletFilter;

      return matchesDateFrom && matchesDateTo && matchesPallet;
    });
  }, [sales, dateFrom, dateTo, palletFilter]);

  const totalPurchasedQuantity = filteredPurchases.reduce(
    (sum, item) => sum + Number(item.quantity),
    0
  );

  const totalSoldQuantity = filteredSales.reduce(
    (sum, item) => sum + Number(item.quantity),
    0
  );

  const totalPurchaseValue = filteredPurchases.reduce(
    (sum, item) => sum + Number(item.total_amount),
    0
  );

  const totalSalesValue = filteredSales.reduce(
    (sum, item) => sum + Number(item.total_amount),
    0
  );

  const grossDifference = totalSalesValue - totalPurchaseValue;

  const averagePurchasePrice =
    totalPurchasedQuantity > 0 ? totalPurchaseValue / totalPurchasedQuantity : 0;

  const averageSalePrice =
    totalSoldQuantity > 0 ? totalSalesValue / totalSoldQuantity : 0;

  const reportByPallet = useMemo(() => {
    const map = new Map<
      string,
      {
        palletName: string;
        purchasedQuantity: number;
        soldQuantity: number;
        purchaseValue: number;
        salesValue: number;
      }
    >();

    filteredPurchases.forEach((purchase) => {
      const palletName = purchase.pallet_types?.name || 'Nepoznata paleta';

      const existing =
        map.get(palletName) ||
        {
          palletName,
          purchasedQuantity: 0,
          soldQuantity: 0,
          purchaseValue: 0,
          salesValue: 0,
        };

      existing.purchasedQuantity += Number(purchase.quantity);
      existing.purchaseValue += Number(purchase.total_amount);

      map.set(palletName, existing);
    });

    filteredSales.forEach((sale) => {
      const palletName = sale.pallet_types?.name || 'Nepoznata paleta';

      const existing =
        map.get(palletName) ||
        {
          palletName,
          purchasedQuantity: 0,
          soldQuantity: 0,
          purchaseValue: 0,
          salesValue: 0,
        };

      existing.soldQuantity += Number(sale.quantity);
      existing.salesValue += Number(sale.total_amount);

      map.set(palletName, existing);
    });

    return Array.from(map.values()).sort((a, b) =>
      a.palletName.localeCompare(b.palletName)
    );
  }, [filteredPurchases, filteredSales]);

  const topCustomers = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        quantity: number;
        value: number;
      }
    >();

    filteredSales.forEach((sale) => {
      const name = sale.customers?.name || 'Nepoznat kupac';

      const existing =
        map.get(name) ||
        {
          name,
          quantity: 0,
          value: 0,
        };

      existing.quantity += Number(sale.quantity);
      existing.value += Number(sale.total_amount);

      map.set(name, existing);
    });

    return Array.from(map.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredSales]);

  const topSuppliers = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        quantity: number;
        value: number;
      }
    >();

    filteredPurchases.forEach((purchase) => {
      const name = purchase.suppliers?.name || 'Nepoznat dobavljač';

      const existing =
        map.get(name) ||
        {
          name,
          quantity: 0,
          value: 0,
        };

      existing.quantity += Number(purchase.quantity);
      existing.value += Number(purchase.total_amount);

      map.set(name, existing);
    });

    return Array.from(map.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredPurchases]);

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
          <p className="text-sm text-green-100">Izveštaji</p>
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

        <Link className="bg-gray-100 px-4 py-2 rounded-xl" href="/dugovanja">
          Dugovanja
        </Link>

        <Link className="bg-green-800 text-white px-4 py-2 rounded-xl" href="/izvestaji">
          Izveštaji
        </Link>
      </nav>

      <section className="p-6">
        {errorMessage ? (
          <div className="mb-4 bg-red-50 text-red-700 px-4 py-3 rounded-xl">
            Greška: {errorMessage}
          </div>
        ) : null}

        <div className="bg-white rounded-2xl shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-green-800 mb-4">
            Filteri izveštaja
          </h2>

          <div className="grid md:grid-cols-4 gap-4">
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

            <div className="flex items-end">
              <button
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                  setPalletFilter('');
                }}
                className="w-full bg-gray-100 px-4 py-2 rounded-xl font-semibold"
              >
                Poništi filtere
              </button>
            </div>
          </div>
        </div>

        <div
          className={
            canViewProfit
              ? 'grid md:grid-cols-3 gap-4 mb-6'
              : 'grid md:grid-cols-2 gap-4 mb-6'
          }
        >
          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-600 text-sm">Ukupno otkupljeno / filtrirano</p>
            <p className="text-3xl font-bold text-green-800 mt-2">
              {totalPurchasedQuantity} kom
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-600 text-sm">Ukupno prodato / filtrirano</p>
            <p className="text-3xl font-bold text-green-800 mt-2">
              {totalSoldQuantity} kom
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-600 text-sm">Razlika komada</p>
            <p
              className={
                totalPurchasedQuantity - totalSoldQuantity >= 0
                  ? 'text-3xl font-bold text-green-800 mt-2'
                  : 'text-3xl font-bold text-red-700 mt-2'
              }
            >
              {totalPurchasedQuantity - totalSoldQuantity} kom
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-600 text-sm">Ukupna vrednost otkupa</p>
            <p className="text-3xl font-bold text-green-800 mt-2">
              {formatRsd(totalPurchaseValue)}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-600 text-sm">Ukupna vrednost prodaje</p>
            <p className="text-3xl font-bold text-green-800 mt-2">
              {formatRsd(totalSalesValue)}
            </p>
          </div>

          {canViewProfit ? (
            <div className="bg-white rounded-2xl shadow p-5">
              <p className="text-gray-600 text-sm">Razlika prodaja - otkup</p>
              <p
                className={
                  grossDifference >= 0
                    ? 'text-3xl font-bold text-green-800 mt-2'
                    : 'text-3xl font-bold text-red-700 mt-2'
                }
              >
                {formatRsd(grossDifference)}
              </p>
            </div>
          ) : null}

          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-600 text-sm">Prosečna nabavna cena</p>
            <p className="text-3xl font-bold text-green-800 mt-2">
              {formatRsd(averagePurchasePrice)}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-600 text-sm">Prosečna prodajna cena</p>
            <p className="text-3xl font-bold text-green-800 mt-2">
              {formatRsd(averageSalePrice)}
            </p>
          </div>

          {canViewProfit ? (
            <div className="bg-white rounded-2xl shadow p-5">
              <p className="text-gray-600 text-sm">Razlika prosečne cene</p>
              <p
                className={
                  averageSalePrice - averagePurchasePrice >= 0
                    ? 'text-3xl font-bold text-green-800 mt-2'
                    : 'text-3xl font-bold text-red-700 mt-2'
                }
              >
                {formatRsd(averageSalePrice - averagePurchasePrice)}
              </p>
            </div>
          ) : null}
        </div>

        <div className="bg-white rounded-2xl shadow p-6 mb-6">
          <h2 className="text-2xl font-bold text-green-800">
            Izveštaj po vrsti palete
          </h2>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-3">Vrsta palete</th>
                  <th className="p-3">Otkupljeno</th>
                  <th className="p-3">Prodato</th>
                  <th className="p-3">Razlika komada</th>
                  <th className="p-3">Vrednost otkupa</th>
                  <th className="p-3">Vrednost prodaje</th>
                  {canViewProfit ? <th className="p-3">Razlika</th> : null}
                </tr>
              </thead>

              <tbody>
                {reportByPallet.map((item) => (
                  <tr key={item.palletName} className="border-b">
                    <td className="p-3 font-medium">{item.palletName}</td>

                    <td className="p-3">{item.purchasedQuantity} kom</td>

                    <td className="p-3">{item.soldQuantity} kom</td>

                    <td
                      className={
                        item.purchasedQuantity - item.soldQuantity >= 0
                          ? 'p-3 font-semibold text-green-800'
                          : 'p-3 font-semibold text-red-700'
                      }
                    >
                      {item.purchasedQuantity - item.soldQuantity} kom
                    </td>

                    <td className="p-3">{formatRsd(item.purchaseValue)}</td>

                    <td className="p-3">{formatRsd(item.salesValue)}</td>

                    {canViewProfit ? (
                      <td
                        className={
                          item.salesValue - item.purchaseValue >= 0
                            ? 'p-3 font-semibold text-green-800'
                            : 'p-3 font-semibold text-red-700'
                        }
                      >
                        {formatRsd(item.salesValue - item.purchaseValue)}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>

            {reportByPallet.length === 0 ? (
              <p className="text-gray-500 mt-4">
                Nema podataka za izabrane filtere.
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-2xl font-bold text-green-800">
              Top kupci
            </h2>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="p-3">Kupac</th>
                    <th className="p-3">Količina</th>
                    <th className="p-3">Vrednost</th>
                  </tr>
                </thead>

                <tbody>
                  {topCustomers.map((item) => (
                    <tr key={item.name} className="border-b">
                      <td className="p-3 font-medium">{item.name}</td>
                      <td className="p-3">{item.quantity} kom</td>
                      <td className="p-3">{formatRsd(item.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {topCustomers.length === 0 ? (
                <p className="text-gray-500 mt-4">
                  Nema prodaje za izabrane filtere.
                </p>
              ) : null}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-2xl font-bold text-green-800">
              Top dobavljači
            </h2>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="p-3">Dobavljač</th>
                    <th className="p-3">Količina</th>
                    <th className="p-3">Vrednost</th>
                  </tr>
                </thead>

                <tbody>
                  {topSuppliers.map((item) => (
                    <tr key={item.name} className="border-b">
                      <td className="p-3 font-medium">{item.name}</td>
                      <td className="p-3">{item.quantity} kom</td>
                      <td className="p-3">{formatRsd(item.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {topSuppliers.length === 0 ? (
                <p className="text-gray-500 mt-4">
                  Nema otkupa za izabrane filtere.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-2xl font-bold text-green-800">
            Trenutno stanje lagera
          </h2>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-3">Vrsta palete</th>
                  <th className="p-3">Stanje</th>
                </tr>
              </thead>

              <tbody>
                {stock.map((item) => (
                  <tr key={item.pallet_type_id} className="border-b">
                    <td className="p-3 font-medium">{item.pallet_type_name}</td>
                    <td
                      className={
                        Number(item.current_quantity) >= 0
                          ? 'p-3 font-semibold text-green-800'
                          : 'p-3 font-semibold text-red-700'
                      }
                    >
                      {item.current_quantity} kom
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
      </section>
    </main>
  );
}