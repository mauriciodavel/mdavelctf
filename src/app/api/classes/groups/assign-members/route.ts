import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceRoleClient } from '@/lib/supabase-server';
import { syncGroupToTeam } from '@/lib/group-team-sync';

interface AssignMembersBody {
  groupId?: string;
  userIds?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const { groupId, userIds }: AssignMembersBody = await request.json();

    if (!groupId || !Array.isArray(userIds)) {
      return NextResponse.json({ error: 'groupId e userIds são obrigatórios' }, { status: 400 });
    }

    const normalizedUserIds = Array.from(new Set(userIds.filter((id) => typeof id === 'string' && id.trim().length > 0)));
    console.log('[assign-members] groupId:', groupId, 'userIds:', userIds, 'normalized:', normalizedUserIds);

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
      .select('id, name, class_id, created_by')
      .eq('id', groupId)
      .single();

    if (groupError || !groupRow) {
      console.error('[assign-members] Group query error:', groupError);
      return NextResponse.json({ error: 'Grupo não encontrado' }, { status: 404 });
    }

    // Get class/instructor info separately
    const { data: classRow, error: classError } = await admin
      .from('classes')
      .select('id, instructor_id')
      .eq('id', groupRow.class_id)
      .single();

    if (classError || !classRow) {
      console.error('[assign-members] Class query error:', classError);
      return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 });
    }

    console.log('[assign-members] groupRow:', groupRow, 'classRow:', classRow);

    const isAdmin = callerProfile.role === 'super_admin' || callerProfile.role === 'admin';
    const isInstructorOwner = callerProfile.role === 'instructor' && classRow.instructor_id === callerUser.id;

    if (!isAdmin && !isInstructorOwner) {
      return NextResponse.json({ error: 'Permissão insuficiente para gerenciar este grupo' }, { status: 403 });
    }

    if (normalizedUserIds.length > 0) {
      const { data: classMembers, error: classMembersError } = await admin
        .from('class_members')
        .select('user_id, status')
        .eq('class_id', groupRow.class_id)
        .in('user_id', normalizedUserIds);

      if (classMembersError) {
        return NextResponse.json({ error: `Falha ao validar alunos da turma: ${classMembersError.message}` }, { status: 400 });
      }

      const allowedUserIds = new Set(
        (classMembers || [])
          .filter((m: any) => m.status !== 'removed')
          .map((m: any) => m.user_id)
      );

      const invalidUserIds = normalizedUserIds.filter((id) => !allowedUserIds.has(id));
      if (invalidUserIds.length > 0) {
        return NextResponse.json({ error: 'Alguns usuários selecionados não pertencem à turma ativa' }, { status: 400 });
      }
    }

    const { data: existingRows, error: existingError } = await admin
      .from('class_group_members')
      .select('user_id')
      .eq('group_id', groupId);

    if (existingError) {
      return NextResponse.json({ error: `Falha ao carregar membros atuais: ${existingError.message}` }, { status: 400 });
    }

    const existingIds = new Set((existingRows || []).map((m: any) => m.user_id));
    const targetIds = new Set(normalizedUserIds);

    const toAdd = normalizedUserIds.filter((id) => !existingIds.has(id));
    const toRemove = Array.from(existingIds).filter((id) => !targetIds.has(id));

    console.log('[assign-members] existing:', Array.from(existingIds), 'target:', Array.from(targetIds), 'toAdd:', toAdd, 'toRemove:', toRemove);

    if (toAdd.length > 0) {
      const { error: addError } = await admin
        .from('class_group_members')
        .upsert(
          toAdd.map((userId) => ({ group_id: groupId, user_id: userId })),
          { onConflict: 'group_id,user_id', ignoreDuplicates: true }
        );

      if (addError) {
        return NextResponse.json({ error: `Falha ao adicionar membros: ${addError.message}` }, { status: 400 });
      }
    }

    if (toRemove.length > 0) {
      const { error: removeError } = await admin
        .from('class_group_members')
        .delete()
        .eq('group_id', groupId)
        .in('user_id', toRemove);

      if (removeError) {
        return NextResponse.json({ error: `Falha ao remover membros: ${removeError.message}` }, { status: 400 });
      }
    }

    const syncResult = await syncGroupToTeam(
      admin,
      { id: groupRow.id, name: groupRow.name, created_by: groupRow.created_by },
      callerUser.id
    );

    console.log('[assign-members] Sync completed, teamId:', syncResult?.teamId);

    return NextResponse.json({
      success: true,
      added: toAdd.length,
      removed: toRemove.length,
      total: normalizedUserIds.length,
      teamId: syncResult?.teamId || null,
    });
  } catch (err: any) {
    console.error('Assign group members API error:', err);
    console.error('Error stack:', err?.stack);
    return NextResponse.json({ 
      error: err?.message || 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'development' ? err?.message : undefined
    }, { status: 500 });
  }
}
