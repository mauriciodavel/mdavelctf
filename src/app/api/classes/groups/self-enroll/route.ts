import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceRoleClient } from '@/lib/supabase-server';

interface SelfEnrollBody {
  groupId?: string;
  action?: 'join' | 'leave';
}

export async function POST(request: NextRequest) {
  try {
    const { groupId, action = 'join' }: SelfEnrollBody = await request.json();

    if (!groupId) {
      return NextResponse.json({ error: 'groupId é obrigatório' }, { status: 400 });
    }

    if (!['join', 'leave'].includes(action)) {
      return NextResponse.json({ error: 'action deve ser "join" ou "leave"' }, { status: 400 });
    }

    const serverSupabase = createServerSupabase();
    const { data: { user: callerUser } } = await serverSupabase.auth.getUser();

    if (!callerUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const admin = createServiceRoleClient();

    // Get group info
    const { data: groupRow, error: groupError } = await admin
      .from('class_groups')
      .select('id, name, max_members, allow_self_enroll, class_id, created_by, classes!inner(id)')
      .eq('id', groupId)
      .single();

    if (groupError || !groupRow) {
      return NextResponse.json({ error: 'Grupo não encontrado' }, { status: 404 });
    }

    if (action === 'join') {
      // Check if group allows self-enroll
      if (!groupRow.allow_self_enroll) {
        return NextResponse.json({ error: 'Este grupo não permite auto-inscrição' }, { status: 403 });
      }

      // Check if user is already a member
      const { data: existingMember } = await admin
        .from('class_group_members')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', callerUser.id)
        .maybeSingle();

      if (existingMember) {
        return NextResponse.json({ error: 'Você já é membro deste grupo' }, { status: 409 });
      }

      // Check if group is full
      if (groupRow.max_members !== null) {
        const { count } = await admin
          .from('class_group_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', groupId);

        if (count !== null && count >= groupRow.max_members) {
          return NextResponse.json({ error: 'Este grupo está cheio' }, { status: 409 });
        }
      }

      // Insert user into group
      const { data: insertedMember, error: insertError } = await admin
        .from('class_group_members')
        .insert({ group_id: groupId, user_id: callerUser.id })
        .select('id')
        .single();

      if (insertError || !insertedMember) {
        console.error('Insert error:', insertError);
        return NextResponse.json(
          { error: insertError?.message || 'Falha ao ingressar no grupo' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Ingressou no grupo ${groupRow.name}!`,
        groupId,
      });
    } else {
      // LEAVE: Delete user from group
      const { error: deleteError } = await admin
        .from('class_group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', callerUser.id);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        return NextResponse.json(
          { error: deleteError.message || 'Falha ao sair do grupo' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Saiu do grupo.',
        groupId,
      });
    }
  } catch (err: any) {
    console.error('Self-enroll API error:', err);
    return NextResponse.json({ error: err?.message || 'Erro interno do servidor' }, { status: 500 });
  }
}
