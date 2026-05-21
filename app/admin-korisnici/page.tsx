'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabaseUrl = 'https://cqwiblmohdjehbeifnko.supabase.co';
const supabaseKey = 'sb_publishable_S8mQrQ5iL8F1ZmO1zjqQfg_ePTqKSZf';

const supabase = createClient(supabaseUrl, supabaseKey);

type UserProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  active: boolean | null;
  can_view_purchase_prices: boolean | null;
  can_view_sale_prices: boolean | null;
  can_view_profit: boolean | null;
  can_approve_changes: boolean | null;
  can_manage_users: boolean | null;
};

type UserPermission = {
  user_id: string;
  can_adjust_stock: boolean | null;
  can_view_finances: boolean | null;
};

type AppUser = UserProfile & {
  can_adjust_stock: boolean;
  can_view_finances: boolean;
};

export default function AdminKorisniciPage() {
  const router = useRouter();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [changingPasswordId, setChangingPasswordId] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [editUserModalOpen, setEditUserModalOpen] = useState(false);

  const [selectedPasswordUser, setSelectedPasswordUser] = useState<AppUser | null>(null);
  const [selectedEditUser, setSelectedEditUser] = useState<AppUser | null>(null);

  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('12345678');

  const [newActive, setNewActive] = useState(true);
  const [newCanViewPurchasePrices, setNewCanViewPurchasePrices] = useState(false);
  const [newCanViewSalePrices, setNewCanViewSalePrices] = useState(false);
  const [newCanViewProfit, setNewCanViewProfit] = useState(false);
  const [newCanViewFinances, setNewCanViewFinances] = useState(false);
  const [newCanAdjustStock, setNewCanAdjustStock] = useState(false);
  const [newCanApproveChanges, setNewCanApproveChanges] = useState(false);
  const [newCanManageUsers, setNewCanManageUsers] = useState(false);

  const [newUserPassword, setNewUserPassword] = useState('');

  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');

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

    const { data: currentProfile, error: currentProfileError } = await supabase
      .from('users_profiles')
      .select('full_name, active, can_manage_users')
      .eq('id', user.id)
      .maybeSingle();

    if (currentProfileError) {
      alert('Greška pri proveri dozvole: ' + currentProfileError.message);
      router.push('/dashboard');
      return;
    }

    if (!currentProfile?.active || !currentProfile?.can_manage_users) {
      alert('Nemate dozvolu za upravljanje korisnicima.');
      router.push('/dashboard');
      return;
    }

    const { data: profilesData, error: profilesError } = await supabase
      .from('users_profiles')
      .select(`
        id,
        email,
        full_name,
        active,
        can_view_purchase_prices,
        can_view_sale_prices,
        can_view_profit,
        can_approve_changes,
        can_manage_users
      `)
      .order('full_name', { ascending: true });

    if (profilesError) {
      setErrorMessage(profilesError.message);
      setLoading(false);
      return;
    }

    const { data: permissionsData, error: permissionsError } = await supabase
      .from('user_permissions')
      .select('user_id, can_adjust_stock, can_view_finances');

    if (permissionsError) {
      setErrorMessage(permissionsError.message);
      setLoading(false);
      return;
    }

    const permissions = (permissionsData || []) as UserPermission[];

    const mergedUsers = ((profilesData || []) as UserProfile[]).map((profile) => {
      const permission = permissions.find((item) => item.user_id === profile.id);

      return {
        ...profile,
        can_adjust_stock: Boolean(permission?.can_adjust_stock),
        can_view_finances: Boolean(permission?.can_view_finances),
      };
    });

    setUsers(mergedUsers);
    setLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  function closeAddModal() {
    setAddModalOpen(false);
    setNewFullName('');
    setNewEmail('');
    setNewPassword('12345678');
    setNewActive(true);
    setNewCanViewPurchasePrices(false);
    setNewCanViewSalePrices(false);
    setNewCanViewProfit(false);
    setNewCanViewFinances(false);
    setNewCanAdjustStock(false);
    setNewCanApproveChanges(false);
    setNewCanManageUsers(false);
  }

  function openPasswordModal(user: AppUser) {
    setSelectedPasswordUser(user);
    setNewUserPassword('');
    setPasswordModalOpen(true);
    setErrorMessage('');
    setSuccessMessage('');
  }

  function closePasswordModal() {
    setSelectedPasswordUser(null);
    setNewUserPassword('');
    setPasswordModalOpen(false);
  }

  function openEditUserModal(user: AppUser) {
    setSelectedEditUser(user);
    setEditFullName(user.full_name || '');
    setEditEmail(user.email || '');
    setEditUserModalOpen(true);
    setErrorMessage('');
    setSuccessMessage('');
  }

  function closeEditUserModal() {
    setSelectedEditUser(null);
    setEditFullName('');
    setEditEmail('');
    setEditUserModalOpen(false);
  }

  async function createNewUser() {
    setErrorMessage('');
    setSuccessMessage('');

    if (!newFullName.trim()) {
      setErrorMessage('Moraš uneti ime korisnika.');
      return;
    }

    if (!newEmail.trim()) {
      setErrorMessage('Moraš uneti email korisnika.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('Lozinka mora imati najmanje 6 karaktera.');
      return;
    }

    setCreatingUser(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setCreatingUser(false);
        setErrorMessage('Sesija je istekla. Prijavi se ponovo.');
        return;
      }

      const response = await fetch('/api/admin-create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: newEmail.trim(),
          password: newPassword,
          full_name: newFullName.trim(),
          active: newActive,
          can_view_purchase_prices: newCanViewPurchasePrices,
          can_view_sale_prices: newCanViewSalePrices,
          can_view_profit: newCanViewProfit,
          can_view_finances: newCanViewFinances,
          can_adjust_stock: newCanAdjustStock,
          can_approve_changes: newCanApproveChanges,
          can_manage_users: newCanManageUsers,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setCreatingUser(false);
        setErrorMessage(result.error || 'Greška pri dodavanju korisnika.');
        return;
      }

      setCreatingUser(false);
      closeAddModal();
      setSuccessMessage(result.message || 'Novi korisnik je uspešno napravljen.');
      await loadData();
    } catch (error: any) {
      setCreatingUser(false);
      setErrorMessage(error?.message || 'Nepoznata greška pri dodavanju korisnika.');
    }
  }

  async function updateUserInfo() {
    if (!selectedEditUser) return;

    setErrorMessage('');
    setSuccessMessage('');

    if (!editFullName.trim()) {
      setErrorMessage('Ime korisnika je obavezno.');
      return;
    }

    if (!editEmail.trim()) {
      setErrorMessage('Email je obavezan.');
      return;
    }

    setUpdatingUserId(selectedEditUser.id);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setUpdatingUserId('');
        setErrorMessage('Sesija je istekla. Prijavi se ponovo.');
        return;
      }

      const response = await fetch('/api/admin-update-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: selectedEditUser.id,
          full_name: editFullName.trim(),
          email: editEmail.trim(),
        }),
      });

      const result = await response.json();

      setUpdatingUserId('');

      if (!response.ok) {
        setErrorMessage(result.error || 'Greška pri izmeni korisnika.');
        return;
      }

      closeEditUserModal();
      setSuccessMessage(result.message || 'Korisnik je uspešno izmenjen.');
      await loadData();
    } catch (error: any) {
      setUpdatingUserId('');
      setErrorMessage(error?.message || 'Nepoznata greška pri izmeni korisnika.');
    }
  }

  async function changeUserPassword() {
    if (!selectedPasswordUser) return;

    setErrorMessage('');
    setSuccessMessage('');

    if (!newUserPassword || newUserPassword.length < 6) {
      setErrorMessage('Nova šifra mora imati najmanje 6 karaktera.');
      return;
    }

    setChangingPasswordId(selectedPasswordUser.id);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setChangingPasswordId('');
      setErrorMessage('Sesija je istekla. Prijavi se ponovo.');
      return;
    }

    const response = await fetch('/api/admin-change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        userId: selectedPasswordUser.id,
        newPassword: newUserPassword,
      }),
    });

    const result = await response.json();

    setChangingPasswordId('');

    if (!response.ok) {
      setErrorMessage(result.error || 'Greška pri promeni šifre.');
      return;
    }

    closePasswordModal();
    setSuccessMessage('Šifra je promenjena.');
  }

  async function updateProfilePermission(
    userId: string,
    field:
      | 'active'
      | 'can_view_purchase_prices'
      | 'can_view_sale_prices'
      | 'can_view_profit'
      | 'can_approve_changes'
      | 'can_manage_users',
    value: boolean
  ) {
    setSavingId(userId);
    setErrorMessage('');
    setSuccessMessage('');

    if (userId === currentUserId && field === 'active' && value === false) {
      setSavingId('');
      setErrorMessage('Ne možeš sam sebi ugasiti nalog.');
      return;
    }

    if (userId === currentUserId && field === 'can_manage_users' && value === false) {
      setSavingId('');
      setErrorMessage('Ne možeš sam sebi skinuti pravo za upravljanje korisnicima.');
      return;
    }

    const { error } = await supabase
      .from('users_profiles')
      .update({
        [field]: value,
      })
      .eq('id', userId);

    setSavingId('');

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage('Izmena je sačuvana.');
    await loadData();
  }

  async function updateUserPermission(
    userId: string,
    field: 'can_adjust_stock' | 'can_view_finances',
    value: boolean
  ) {
    setSavingId(userId);
    setErrorMessage('');
    setSuccessMessage('');

    const currentUser = users.find((item) => item.id === userId);

    const { error } = await supabase
      .from('user_permissions')
      .upsert(
        {
          user_id: userId,
          can_adjust_stock:
            field === 'can_adjust_stock'
              ? value
              : Boolean(currentUser?.can_adjust_stock),
          can_view_finances:
            field === 'can_view_finances'
              ? value
              : Boolean(currentUser?.can_view_finances),
        },
        {
          onConflict: 'user_id',
        }
      );

    setSavingId('');

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage('Izmena je sačuvana.');
    await loadData();
  }

  function yesNo(value: boolean | null) {
    return value ? 'DA' : 'NE';
  }

  function permissionButtonClass(value: boolean | null) {
    if (value) {
      return 'bg-green-100 text-green-800 border border-green-200';
    }

    return 'bg-gray-100 text-gray-700 border border-gray-200';
  }

  function newPermissionButtonClass(value: boolean) {
    if (value) {
      return 'bg-green-100 text-green-800 border border-green-200';
    }

    return 'bg-gray-100 text-gray-700 border border-gray-200';
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

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="bg-green-900 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Euro Trade Plus</h1>
          <p className="text-sm text-green-100">Admin korisnici</p>
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

        <Link className="bg-gray-100 px-4 py-2 rounded-xl" href="/admin-zahtevi">
          Admin zahtevi
        </Link>

        <Link
          className="bg-purple-100 text-purple-900 px-4 py-2 rounded-xl font-semibold"
          href="/admin-korisnici"
        >
          Admin korisnici
        </Link>

        <Link className="bg-gray-100 px-4 py-2 rounded-xl" href="/lista-otkupa">
          Lista otkupa
        </Link>

        <Link className="bg-gray-100 px-4 py-2 rounded-xl" href="/lista-prodaje">
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

        <div className="flex justify-between items-center mb-6 gap-3 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-green-900">
              Upravljanje korisnicima
            </h2>
            <p className="text-gray-600 text-sm">
              Dodavanje korisnika, izmena imena/emaila, dozvole i promena šifre.
            </p>
          </div>

          <button
            onClick={() => {
              setErrorMessage('');
              setSuccessMessage('');
              setAddModalOpen(true);
            }}
            className="bg-green-800 text-white px-5 py-3 rounded-xl font-semibold"
          >
            + Dodaj korisnika
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-600 text-sm">Ukupno korisnika</p>
            <p className="text-3xl font-bold text-green-800 mt-2">
              {users.length}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-600 text-sm">Aktivni korisnici</p>
            <p className="text-3xl font-bold text-green-800 mt-2">
              {users.filter((user) => user.active).length}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-600 text-sm">Neaktivni korisnici</p>
            <p className="text-3xl font-bold text-red-700 mt-2">
              {users.filter((user) => !user.active).length}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-3">Korisnik</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Podaci</th>
                  <th className="p-3">Šifra</th>
                  <th className="p-3">Aktivan</th>
                  <th className="p-3">Nabavne cene</th>
                  <th className="p-3">Prodajne cene</th>
                  <th className="p-3">Profit</th>
                  <th className="p-3">Finansije</th>
                  <th className="p-3">Korekcija lagera</th>
                  <th className="p-3">Odobrava zahteve</th>
                  <th className="p-3">Upravlja korisnicima</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b">
                    <td className="p-3 min-w-[180px]">
                      <p className="font-bold text-gray-800">
                        {user.full_name || 'Bez imena'}
                      </p>

                      {user.id === currentUserId ? (
                        <p className="text-xs text-purple-700 font-semibold mt-1">
                          Trenutno prijavljen korisnik
                        </p>
                      ) : null}
                    </td>

                    <td className="p-3 min-w-[220px]">
                      {user.email || '-'}
                    </td>

                    <td className="p-3">
                      <button
                        onClick={() => openEditUserModal(user)}
                        className="bg-purple-100 text-purple-800 px-3 py-2 rounded-xl text-xs font-semibold"
                      >
                        Izmeni ime/email
                      </button>
                    </td>

                    <td className="p-3">
                      <button
                        onClick={() => openPasswordModal(user)}
                        className="bg-blue-100 text-blue-800 px-3 py-2 rounded-xl text-xs font-semibold"
                      >
                        Promeni šifru
                      </button>
                    </td>

                    <td className="p-3">
                      <button
                        disabled={savingId === user.id}
                        onClick={() =>
                          updateProfilePermission(
                            user.id,
                            'active',
                            !Boolean(user.active)
                          )
                        }
                        className={`px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-60 ${permissionButtonClass(
                          Boolean(user.active)
                        )}`}
                      >
                        {yesNo(Boolean(user.active))}
                      </button>
                    </td>

                    <td className="p-3">
                      <button
                        disabled={savingId === user.id}
                        onClick={() =>
                          updateProfilePermission(
                            user.id,
                            'can_view_purchase_prices',
                            !Boolean(user.can_view_purchase_prices)
                          )
                        }
                        className={`px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-60 ${permissionButtonClass(
                          Boolean(user.can_view_purchase_prices)
                        )}`}
                      >
                        {yesNo(Boolean(user.can_view_purchase_prices))}
                      </button>
                    </td>

                    <td className="p-3">
                      <button
                        disabled={savingId === user.id}
                        onClick={() =>
                          updateProfilePermission(
                            user.id,
                            'can_view_sale_prices',
                            !Boolean(user.can_view_sale_prices)
                          )
                        }
                        className={`px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-60 ${permissionButtonClass(
                          Boolean(user.can_view_sale_prices)
                        )}`}
                      >
                        {yesNo(Boolean(user.can_view_sale_prices))}
                      </button>
                    </td>

                    <td className="p-3">
                      <button
                        disabled={savingId === user.id}
                        onClick={() =>
                          updateProfilePermission(
                            user.id,
                            'can_view_profit',
                            !Boolean(user.can_view_profit)
                          )
                        }
                        className={`px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-60 ${permissionButtonClass(
                          Boolean(user.can_view_profit)
                        )}`}
                      >
                        {yesNo(Boolean(user.can_view_profit))}
                      </button>
                    </td>

                    <td className="p-3">
                      <button
                        disabled={savingId === user.id}
                        onClick={() =>
                          updateUserPermission(
                            user.id,
                            'can_view_finances',
                            !Boolean(user.can_view_finances)
                          )
                        }
                        className={`px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-60 ${permissionButtonClass(
                          Boolean(user.can_view_finances)
                        )}`}
                      >
                        {yesNo(Boolean(user.can_view_finances))}
                      </button>
                    </td>

                    <td className="p-3">
                      <button
                        disabled={savingId === user.id}
                        onClick={() =>
                          updateUserPermission(
                            user.id,
                            'can_adjust_stock',
                            !Boolean(user.can_adjust_stock)
                          )
                        }
                        className={`px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-60 ${permissionButtonClass(
                          Boolean(user.can_adjust_stock)
                        )}`}
                      >
                        {yesNo(Boolean(user.can_adjust_stock))}
                      </button>
                    </td>

                    <td className="p-3">
                      <button
                        disabled={savingId === user.id}
                        onClick={() =>
                          updateProfilePermission(
                            user.id,
                            'can_approve_changes',
                            !Boolean(user.can_approve_changes)
                          )
                        }
                        className={`px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-60 ${permissionButtonClass(
                          Boolean(user.can_approve_changes)
                        )}`}
                      >
                        {yesNo(Boolean(user.can_approve_changes))}
                      </button>
                    </td>

                    <td className="p-3">
                      <button
                        disabled={savingId === user.id}
                        onClick={() =>
                          updateProfilePermission(
                            user.id,
                            'can_manage_users',
                            !Boolean(user.can_manage_users)
                          )
                        }
                        className={`px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-60 ${permissionButtonClass(
                          Boolean(user.can_manage_users)
                        )}`}
                      >
                        {yesNo(Boolean(user.can_manage_users))}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {users.length === 0 ? (
              <p className="text-gray-500 mt-4">
                Nema korisnika za prikaz.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {addModalOpen ? (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start gap-3 mb-5">
              <div>
                <h2 className="text-2xl font-bold text-green-800">
                  Dodaj novog korisnika
                </h2>
                <p className="text-sm text-gray-600">
                  Unesi ime, email za login, početnu šifru i dozvole.
                </p>
              </div>

              <button
                onClick={closeAddModal}
                className="bg-gray-100 px-3 py-2 rounded-xl font-semibold"
              >
                X
              </button>
            </div>

            {errorMessage ? (
              <div className="mb-4 bg-red-50 text-red-700 px-4 py-3 rounded-xl">
                Greška: {errorMessage}
              </div>
            ) : null}

            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Ime i prezime
                </label>
                <input
                  value={newFullName}
                  onChange={(event) => setNewFullName(event.target.value)}
                  placeholder="Npr. Marko Marković"
                  className="w-full border rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Email za login
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  placeholder="marko@eurotradeplus.rs"
                  className="w-full border rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Početna šifra
                </label>
                <input
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="12345678"
                  className="w-full border rounded-xl px-3 py-2"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-5">
              <button type="button" onClick={() => setNewActive(!newActive)} className={`px-3 py-2 rounded-xl text-xs font-semibold ${newPermissionButtonClass(newActive)}`}>
                Aktivan: {yesNo(newActive)}
              </button>

              <button type="button" onClick={() => setNewCanViewPurchasePrices(!newCanViewPurchasePrices)} className={`px-3 py-2 rounded-xl text-xs font-semibold ${newPermissionButtonClass(newCanViewPurchasePrices)}`}>
                Nabavne cene: {yesNo(newCanViewPurchasePrices)}
              </button>

              <button type="button" onClick={() => setNewCanViewSalePrices(!newCanViewSalePrices)} className={`px-3 py-2 rounded-xl text-xs font-semibold ${newPermissionButtonClass(newCanViewSalePrices)}`}>
                Prodajne cene: {yesNo(newCanViewSalePrices)}
              </button>

              <button type="button" onClick={() => setNewCanViewProfit(!newCanViewProfit)} className={`px-3 py-2 rounded-xl text-xs font-semibold ${newPermissionButtonClass(newCanViewProfit)}`}>
                Profit: {yesNo(newCanViewProfit)}
              </button>

              <button type="button" onClick={() => setNewCanViewFinances(!newCanViewFinances)} className={`px-3 py-2 rounded-xl text-xs font-semibold ${newPermissionButtonClass(newCanViewFinances)}`}>
                Finansije: {yesNo(newCanViewFinances)}
              </button>

              <button type="button" onClick={() => setNewCanAdjustStock(!newCanAdjustStock)} className={`px-3 py-2 rounded-xl text-xs font-semibold ${newPermissionButtonClass(newCanAdjustStock)}`}>
                Korekcija lagera: {yesNo(newCanAdjustStock)}
              </button>

              <button type="button" onClick={() => setNewCanApproveChanges(!newCanApproveChanges)} className={`px-3 py-2 rounded-xl text-xs font-semibold ${newPermissionButtonClass(newCanApproveChanges)}`}>
                Odobrava zahteve: {yesNo(newCanApproveChanges)}
              </button>

              <button type="button" onClick={() => setNewCanManageUsers(!newCanManageUsers)} className={`px-3 py-2 rounded-xl text-xs font-semibold ${newPermissionButtonClass(newCanManageUsers)}`}>
                Upravlja korisnicima: {yesNo(newCanManageUsers)}
              </button>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={closeAddModal}
                className="bg-gray-100 px-4 py-2 rounded-xl font-semibold"
              >
                Otkaži
              </button>

              <button
                onClick={createNewUser}
                disabled={creatingUser}
                className="bg-green-800 text-white px-5 py-2 rounded-xl font-semibold disabled:opacity-60"
              >
                {creatingUser ? 'Kreiranje...' : 'Dodaj korisnika'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editUserModalOpen && selectedEditUser ? (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-green-800 mb-2">
              Izmena korisnika
            </h2>

            <p className="text-sm text-gray-600 mb-4">
              Ovde menjaš ime koje se prikazuje u aplikaciji i email za login.
            </p>

            {errorMessage ? (
              <div className="mb-4 bg-red-50 text-red-700 px-4 py-3 rounded-xl">
                Greška: {errorMessage}
              </div>
            ) : null}

            <label className="block text-sm text-gray-600 mb-1">
              Ime i prezime
            </label>
            <input
              value={editFullName}
              onChange={(event) => setEditFullName(event.target.value)}
              placeholder="Ime i prezime"
              className="w-full border rounded-xl px-3 py-2 mb-4"
            />

            <label className="block text-sm text-gray-600 mb-1">
              Email za login
            </label>
            <input
              type="email"
              value={editEmail}
              onChange={(event) => setEditEmail(event.target.value)}
              placeholder="email@primer.rs"
              className="w-full border rounded-xl px-3 py-2 mb-4"
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={closeEditUserModal}
                className="bg-gray-100 px-4 py-2 rounded-xl font-semibold"
              >
                Otkaži
              </button>

              <button
                onClick={updateUserInfo}
                disabled={updatingUserId === selectedEditUser.id}
                className="bg-green-800 text-white px-4 py-2 rounded-xl font-semibold disabled:opacity-60"
              >
                {updatingUserId === selectedEditUser.id
                  ? 'Čuvam...'
                  : 'Sačuvaj izmene'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {passwordModalOpen && selectedPasswordUser ? (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-green-800 mb-2">
              Promena šifre
            </h2>

            <p className="text-sm text-gray-600 mb-4">
              Korisnik: <b>{selectedPasswordUser.full_name || '-'}</b>
              <br />
              Email: <b>{selectedPasswordUser.email || '-'}</b>
            </p>

            {errorMessage ? (
              <div className="mb-4 bg-red-50 text-red-700 px-4 py-3 rounded-xl">
                Greška: {errorMessage}
              </div>
            ) : null}

            <label className="block text-sm text-gray-600 mb-1">
              Nova šifra
            </label>
            <input
              value={newUserPassword}
              onChange={(event) => setNewUserPassword(event.target.value)}
              placeholder="Nova šifra"
              className="w-full border rounded-xl px-3 py-2 mb-4"
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={closePasswordModal}
                className="bg-gray-100 px-4 py-2 rounded-xl font-semibold"
              >
                Otkaži
              </button>

              <button
                onClick={changeUserPassword}
                disabled={changingPasswordId === selectedPasswordUser.id}
                className="bg-blue-700 text-white px-4 py-2 rounded-xl font-semibold disabled:opacity-60"
              >
                {changingPasswordId === selectedPasswordUser.id
                  ? 'Menjam...'
                  : 'Sačuvaj novu šifru'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}