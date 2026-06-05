import type { SupabaseClient } from '@supabase/supabase-js';

interface GroupRow {
  id: string;
  name: string;
  created_by?: string | null;
}

const GROUP_TEAM_MARKER_PREFIX = 'class-group:';

function getGroupTeamMarker(groupId: string): string {
  return `${GROUP_TEAM_MARKER_PREFIX}${groupId}`;
}

export function isClassGroupTeam(team: any): boolean {
  return typeof team?.image_url === 'string' && team.image_url.startsWith(GROUP_TEAM_MARKER_PREFIX);
}

export async function syncGroupToTeam(admin: SupabaseClient, group: GroupRow, fallbackCreatorId: string) {
  const marker = getGroupTeamMarker(group.id);

  let teamId: string | null = null;
  let team: any = null;

  // First, try to find existing team by marker (use limit to avoid "multiple rows" error)
  const { data: existingTeams, error: existingTeamError } = await admin
    .from('teams')
    .select('id, code, name, image_url')
    .eq('image_url', marker)
    .limit(1);

  if (existingTeamError) {
    throw new Error(`Falha ao buscar equipe do grupo: ${existingTeamError.message}`);
  }

  const existingTeam = existingTeams && existingTeams.length > 0 ? existingTeams[0] : null;

  if (existingTeam) {
    // Team already exists, use it
    team = existingTeam;
    teamId = existingTeam.id;
  } else {
    // Team doesn't exist, create it
    const { data: createdTeam, error: createTeamError } = await admin
      .from('teams')
      .insert({
        name: group.name,
        is_public: false,
        image_url: marker,
        created_by: group.created_by || fallbackCreatorId,
      })
      .select('id, code, name, image_url')
      .single();

    if (createTeamError || !createdTeam) {
      throw new Error(`Falha ao criar equipe do grupo: ${createTeamError?.message || 'erro desconhecido'}`);
    }

    team = createdTeam;
    teamId = createdTeam.id;
  }

  const { data: groupMembers, error: groupMembersError } = await admin
    .from('class_group_members')
    .select('user_id')
    .eq('group_id', group.id);

  if (groupMembersError) {
    throw new Error(`Falha ao carregar membros do grupo: ${groupMembersError.message}`);
  }

  const groupUserIds = Array.from(new Set((groupMembers || []).map((m: any) => m.user_id).filter(Boolean)));

  const { data: teamMembers, error: teamMembersError } = await admin
    .from('team_members')
    .select('user_id, role')
    .eq('team_id', teamId);

  if (teamMembersError) {
    throw new Error(`Falha ao carregar membros da equipe: ${teamMembersError.message}`);
  }

  const existingUserIds = new Set((teamMembers || []).map((m: any) => m.user_id));
  const targetUserIds = new Set(groupUserIds);

  const toAdd = groupUserIds.filter((id) => !existingUserIds.has(id));
  const toRemove = Array.from(existingUserIds).filter((id) => !targetUserIds.has(id));

  if (toAdd.length > 0) {
    const { error: addTeamMembersError } = await admin
      .from('team_members')
      .upsert(
        toAdd.map((userId) => ({ team_id: teamId, user_id: userId, role: 'member' })),
        { onConflict: 'team_id,user_id', ignoreDuplicates: true }
      );

    if (addTeamMembersError) {
      throw new Error(`Falha ao adicionar membros na equipe: ${addTeamMembersError.message}`);
    }
  }

  if (toRemove.length > 0) {
    const { error: removeTeamMembersError } = await admin
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .in('user_id', toRemove);

    if (removeTeamMembersError) {
      throw new Error(`Falha ao remover membros da equipe: ${removeTeamMembersError.message}`);
    }
  }

  const { data: finalTeamMembers, error: finalTeamMembersError } = await admin
    .from('team_members')
    .select('user_id, role')
    .eq('team_id', teamId);

  if (finalTeamMembersError) {
    throw new Error(`Falha ao validar liderança da equipe: ${finalTeamMembersError.message}`);
  }

  const hasLeader = (finalTeamMembers || []).some((m: any) => m.role === 'leader');
  if (!hasLeader && groupUserIds.length > 0) {
    const leaderUserId = groupUserIds[0];
    const { error: leaderError } = await admin
      .from('team_members')
      .upsert(
        { team_id: teamId, user_id: leaderUserId, role: 'leader' },
        { onConflict: 'team_id,user_id' }
      );

    if (leaderError) {
      throw new Error(`Falha ao definir líder da equipe: ${leaderError.message}`);
    }
  }

  return {
    team,
    teamId,
    memberCount: groupUserIds.length,
  };
}
