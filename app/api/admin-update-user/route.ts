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
        { error: 'Nemate dozvolu za izmenu korisnika.' },
        { status: 403 }
      );
    }

    const body = await req.json();

    const userId = String(body.userId || '').trim();
    const fullName = String(body.full_name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();

    if (!userId) {
      return NextResponse.json(
        { error: 'Nedostaje ID korisnika.' },
        { status: 400 }
      );
    }

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

    const { error: authUpdateError } =
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        email,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
        },
      });

    if (authUpdateError) {
      return NextResponse.json(
        { error: authUpdateError.message },
        { status: 400 }
      );
    }

    const { error: profileUpdateError } = await supabaseAdmin
      .from('users_profiles')
      .update({
        full_name: fullName,
        email,
      })
      .eq('id', userId);

    if (profileUpdateError) {
      return NextResponse.json(
        { error: profileUpdateError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Korisnik je uspešno izmenjen.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Nepoznata greška.' },
      { status: 500 }
    );
  }
}