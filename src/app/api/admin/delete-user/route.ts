import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, createServerSupabase } from '@/lib/supabase-server';

interface DeleteUserBody {
  targetUserId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { targetUserId }: DeleteUserBody = await request.json();

    if (!targetUserId) {
      return NextResponse.json({ error: 'targetUserId é obrigatório' }, { status: 400 });
    }

    const serverSupabase = createServerSupabase();
    const { data: { user: callerUser } } = await serverSupabase.auth.getUser();

    if (!callerUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    if (callerUser.id === targetUserId) {
      return NextResponse.json({ error: 'Não é possível excluir a si mesmo' }, { status: 400 });
    }

    const admin = createServiceRoleClient();

    const { data: callerProfile, error: callerProfileError } = await admin
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    if (callerProfileError || !callerProfile || !['super_admin', 'admin'].includes(callerProfile.role)) {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }

    // Optional safeguard: admin cannot delete super_admin.
    const { data: targetProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', targetUserId)
      .maybeSingle();

    if (targetProfile?.role === 'super_admin' && callerProfile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Apenas Super Admin pode excluir outro Super Admin' }, { status: 403 });
    }

    // Delete from auth.users. With FK ON DELETE CASCADE on profiles.id -> auth.users.id,
    // profile and dependent records are removed automatically.
    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(targetUserId);

    if (deleteAuthError) {
      return NextResponse.json({ error: deleteAuthError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Delete user API error:', err);
    return NextResponse.json({ error: err?.message || 'Erro interno do servidor' }, { status: 500 });
  }
}
