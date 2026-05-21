import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cqwiblmohdjehbeifnko.supabase.co';
const supabaseAnonKey = 'sb_publishable_S8mQrQ5iL8F1ZmO1zjqQfg_ePTqKSZf';

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: NextRequest) {
  try {
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Nedostaje SUPABASE_SERVICE_ROLE_KEY u .env.local fajlu.' },
        { status: 500 }
      );
    }

    const authHeader = req.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Niste autorizovani.' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    const userClient = createClient(supabaseUrl, supabaseAnonKey);

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Sesija nije validna. Ulogujte se ponovo.' },
        { status: 401 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
      .from('users_profiles')
      .select('id, active, can_manage_users')
      .eq('id', user.id)
      .single();

    if (adminProfileError || !adminProfile) {
      return NextResponse.json(
        { error: 'Admin profil nije pronađen.' },
        { status: 403 }
      );
    }

    if (!adminProfile.active || !adminProfile.can_manage_users) {
      return NextResponse.json(
        { error: 'Nemate dozvolu za dodavanje korisnika.' },
        { status: 403 }
      );
    }

    const body = await req.json();

    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '').trim();
    const fullName = String(body.full_name || '').trim();

    if (!fullName) {
      return NextResponse.json(
        { error: 'Ime korisnika je obavezno.' },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: 'Email je obavezan.' },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: 'Šifra mora imati najmanje 6 karaktera.' },
        { status: 400 }
      );
    }

    const active = body.active === undefined ? true : Boolean(body.active);

    const canViewPurchasePrices = Boolean(body.can_view_purchase_prices);
    const canViewSalePrices = Boolean(body.can_view_sale_prices);
    const canViewProfit = Boolean(body.can_view_profit);
    const canApproveChanges = Boolean(body.can_approve_changes);
    const canManageUsers = Boolean(body.can_manage_users);

    const canViewFinances = Boolean(body.can_view_finances);
    const canAdjustStock = Boolean(body.can_adjust_stock);

    /*
      VAŽNO:
      Tvoja users_profiles.role kolona ima CHECK constraint.
      Pošto baza ne prihvata "radnik", ovde stavljamo "admin" kao tehničku vrednost.
      Prava u aplikaciji se NE kontrolišu preko role, nego preko boolean kolona:
      can_manage_users, can_approve_changes, can_view_profit itd.
    */
    const role = 'admin';

    const { data: createdUserData, error: createUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role,
        },
      });

    if (createUserError) {
      return NextResponse.json(
        { error: createUserError.message },
        { status: 400 }
      );
    }

    const createdUser = createdUserData.user;

    if (!createdUser || !createdUser.id) {
      return NextResponse.json(
        { error: 'Korisnik nije napravljen u Supabase Auth.' },
        { status: 400 }
      );
    }

    const { error: profileError } = await supabaseAdmin
      .from('users_profiles')
      .upsert(
        {
          id: createdUser.id,
          email,
          full_name: fullName,
          role,
          active,
          can_view_purchase_prices: canViewPurchasePrices,
          can_view_sale_prices: canViewSalePrices,
          can_view_profit: canViewProfit,
          can_approve_changes: canApproveChanges,
          can_manage_users: canManageUsers,
        },
        {
          onConflict: 'id',
        }
      );

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(createdUser.id);

      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      );
    }

    const { error: permissionsError } = await supabaseAdmin
      .from('user_permissions')
      .upsert(
        {
          user_id: createdUser.id,
          can_adjust_stock: canAdjustStock,
          can_view_finances: canViewFinances,
        },
        {
          onConflict: 'user_id',
        }
      );

    if (permissionsError) {
      return NextResponse.json(
        {
          error:
            'Korisnik je napravljen, ali dozvole nisu upisane: ' +
            permissionsError.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Korisnik je uspešno kreiran.',
      user: {
        id: createdUser.id,
        email,
        full_name: fullName,
        role,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Nepoznata greška.' },
      { status: 500 }
    );
  }
}