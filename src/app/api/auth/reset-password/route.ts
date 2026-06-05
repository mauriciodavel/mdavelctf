import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, createServerSupabase } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const { targetUserId, newPassword } = await request.json();

    if (!targetUserId || !newPassword) {
      return NextResponse.json({ error: 'targetUserId e newPassword são obrigatórios' }, { status: 400 });
    }

    // Verify the caller is authenticated and is an instructor/admin
    const serverSupabase = createServerSupabase();
    const { data: { user: callerUser } } = await serverSupabase.auth.getUser();

    if (!callerUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Check caller role
    const admin = createServiceRoleClient();
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    if (!callerProfile || !['super_admin', 'admin', 'instructor'].includes(callerProfile.role)) {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }

    // For instructors, ensure target user is in one of their classes
    if (callerProfile.role === 'instructor') {
      const { data: classMembership } = await admin
        .from('class_members')
        .select('class_id, classes!inner(instructor_id)')
        .eq('user_id', targetUserId)
        .eq('status', 'active');

      const isInInstructorClass = (classMembership || []).some(
        (m: any) => m.classes?.instructor_id === callerUser.id
      );

      if (!isInInstructorClass) {
        return NextResponse.json({ error: 'Usuário não pertence às suas turmas' }, { status: 403 });
      }
    }

    // Reset password using admin API
    const { error } = await admin.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Reset password API error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
