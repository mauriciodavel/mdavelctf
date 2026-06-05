import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceRoleClient } from '@/lib/supabase-server';
import { syncGroupToTeam } from '@/lib/group-team-sync';

interface SyncTeamBody {
  groupId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { groupId }: SyncTeamBody = await request.json();

    if (!groupId) {
      return NextResponse.json({ error: 'groupId é obrigatório' }, { status: 400 });
    }

    const serverSupabase = createServerSupabase();
    const { data: { user: callerUser } } = await serverSupabase.auth.getUser();

    if (!callerUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const admin = createServiceRoleClient();

    const { data: callerProfile, error: callerProfileError } = await admin
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    if (callerProfileError || !callerProfile) {
      return NextResponse.json({ error: 'Perfil do solicitante não encontrado' }, { status: 403 });
    }

    const { data: groupRow, error: groupError } = await admin
      .from('class_groups')
      .select('id, name, class_id, created_by, classes!inner(instructor_id)')
      .eq('id', groupId)
      .single();

    if (groupError || !groupRow) {
      return NextResponse.json({ error: 'Grupo não encontrado' }, { status: 404 });
    }

    const isAdmin = callerProfile.role === 'super_admin' || callerProfile.role === 'admin';
    const isInstructorOwner = callerProfile.role === 'instructor' && groupRow.classes?.instructor_id === callerUser.id;

    const { data: membership } = await admin
      .from('class_group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', callerUser.id)
      .maybeSingle();

    const isMember = Boolean(membership);

    if (!isAdmin && !isInstructorOwner && !isMember) {
      return NextResponse.json({ error: 'Permissão insuficiente para sincronizar equipe deste grupo' }, { status: 403 });
    }

    const syncResult = await syncGroupToTeam(
      admin,
      { id: groupRow.id, name: groupRow.name, created_by: groupRow.created_by },
      callerUser.id
    );

    return NextResponse.json({
      success: true,
      team: syncResult.team,
      memberCount: syncResult.memberCount,
    });
  } catch (err: any) {
    console.error('Sync group team API error:', err);
    return NextResponse.json({ error: err?.message || 'Erro interno do servidor' }, { status: 500 });
  }
}
