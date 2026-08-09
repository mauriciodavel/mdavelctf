import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const { email, password, displayName } = await request.json();

    if (!email || !password || !displayName) {
      return NextResponse.json({ error: 'email, password e displayName são obrigatórios' }, { status: 400 });
    }

    const admin = createServiceRoleClient();

    // Create user with email auto-confirmed (no email verification needed)
    const { data, error } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName.trim(),
        // Public registration must never accept authorization data from the client.
        role: 'competitor',
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ user: { id: data.user.id, email: data.user.email } }, { status: 201 });
  } catch (err: any) {
    console.error('Register API error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
