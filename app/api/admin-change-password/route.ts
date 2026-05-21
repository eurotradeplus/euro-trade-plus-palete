import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cqwiblmohdjehbeifnko.supabase.co';

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function POST(request: NextRequest) {
  try {
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Nedostaje SUPABASE_SERVICE_ROLE_KEY u .env.local fajlu.' },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      return NextResponse.json(
        { error: 'Niste prijavljeni.' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Nevažeća sesija.' },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users_profiles')
      .select('active, can_manage_users')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile?.active || !profile?.can_manage_users) {
      return NextResponse.json(
        { error: 'Nemate dozvolu za promenu šifre.' },
        { status: 403 }
      );
    }

    const body = await request.json();

    const userId = body.userId as string;
    const newPassword = body.newPassword as string;

    if (!userId) {
      return NextResponse.json(
        { error: 'Nedostaje korisnik.' },
        { status: 400 }
      );
    }

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Nova šifra mora imati najmanje 6 karaktera.' },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        password: newPassword,
      }
    );

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Nepoznata greška.' },
      { status: 500 }
    );
  }
}