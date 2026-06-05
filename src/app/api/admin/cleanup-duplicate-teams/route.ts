import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceRoleClient } from '@/lib/supabase-server';

/**
 * ADMIN ENDPOINT: Clean up duplicate class-group teams
 * POST /api/admin/cleanup-duplicate-teams
 * 
 * For each group, if multiple teams exist with marker "class-group:<group_id>",
 * keep the oldest and delete the rest. Also sync memberships to the kept team.
 */
export async function POST(request: NextRequest) {
  try {
    const serverSupabase = createServerSupabase();
    const { data: { user: callerUser } } = await serverSupabase.auth.getUser();

    if (!callerUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const admin = createServiceRoleClient();

    // Get caller role
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    const isAdmin = callerProfile?.role === 'super_admin' || callerProfile?.role === 'admin';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Apenas administradores podem executar essa operação' }, { status: 403 });
    }

    // Find all teams with class-group markers
    const { data: allClassGroupTeams } = await admin
      .from('teams')
      .select('id, image_url, created_at')
      .ilike('image_url', 'class-group:%');

    if (!allClassGroupTeams) {
      return NextResponse.json({
        success: true,
        duplicatesRemoved: 0,
        message: 'Nenhuma equipe de grupo encontrada',
      });
    }

    // Group teams by marker
    const teamsByMarker: Record<string, any[]> = {};
    for (const team of allClassGroupTeams) {
      if (!teamsByMarker[team.image_url]) {
        teamsByMarker[team.image_url] = [];
      }
      teamsByMarker[team.image_url].push(team);
    }

    // Process duplicates
    let totalRemoved = 0;
    const markerStatuses: Record<string, string> = {};

    for (const [marker, teams] of Object.entries(teamsByMarker)) {
      if (teams.length > 1) {
        // Sort by created_at, keep oldest
        teams.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const keepTeamId = teams[0].id;
        const deleteTeamIds = teams.slice(1).map((t: any) => t.id);

        // Merge memberships: add members from duplicate teams to the kept team
        for (const deleteTeamId of deleteTeamIds) {
          const { data: membersToTransfer } = await admin
            .from('team_members')
            .select('user_id, role')
            .eq('team_id', deleteTeamId);

          if (membersToTransfer && membersToTransfer.length > 0) {
            // Only add members if they're not already in kept team
            const { data: existingMembers } = await admin
              .from('team_members')
              .select('user_id')
              .eq('team_id', keepTeamId);

            const existingUserIds = new Set((existingMembers || []).map((m: any) => m.user_id));
            const membersToAdd = membersToTransfer.filter((m: any) => !existingUserIds.has(m.user_id));

            if (membersToAdd.length > 0) {
              await admin.from('team_members').upsert(
                membersToAdd.map((m: any) => ({ ...m, team_id: keepTeamId })),
                { onConflict: 'team_id,user_id', ignoreDuplicates: true }
              );
            }
          }
        }

        // Delete duplicate teams
        await admin.from('teams').delete().in('id', deleteTeamIds);
        totalRemoved += deleteTeamIds.length;
        markerStatuses[marker] = `Removidas ${deleteTeamIds.length} cópia(s), mantida equipe ${keepTeamId}`;
      }
    }

    return NextResponse.json({
      success: true,
      duplicatesRemoved: totalRemoved,
      markerStatuses,
      message: `Limpeza concluída: ${totalRemoved} equipa(s) duplicada(s) removida(s)`,
    });
  } catch (err: any) {
    console.error('Cleanup duplicate teams error:', err);
    return NextResponse.json({ error: err?.message || 'Erro interno do servidor' }, { status: 500 });
  }
}
