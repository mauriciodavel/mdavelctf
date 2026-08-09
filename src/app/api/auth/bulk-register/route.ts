import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, createServerSupabase } from '@/lib/supabase-server';

interface BulkUser {
  email: string;
  display_name: string;
  password: string;
  class_id?: string;
  group_id?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { users }: { users: BulkUser[] } = await request.json();

    // Bound the work an authenticated operator can make the service-role key do.
    if (!Array.isArray(users) || users.length === 0 || users.length > 100) {
      return NextResponse.json({ error: 'Lista de usuários é obrigatória' }, { status: 400 });
    }

    // Verify the caller is authenticated and is an instructor/admin
    const serverSupabase = createServerSupabase();
    const { data: { user: callerUser } } = await serverSupabase.auth.getUser();

    if (!callerUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const admin = createServiceRoleClient();
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    if (!callerProfile || !['super_admin', 'admin', 'instructor'].includes(callerProfile.role)) {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }

    const results: { email: string; success: boolean; error?: string; userId?: string }[] = [];

    for (const u of users) {
      if (!u.email || !u.display_name || !u.password) {
        results.push({ email: u.email || '?', success: false, error: 'Campos obrigatórios ausentes' });
        continue;
      }

      if (u.password.length < 8 || u.password.length > 128) {
        results.push({ email: u.email, success: false, error: 'A senha deve ter entre 8 e 128 caracteres' });
        continue;
      }

      // Create auth user
      const { data, error: createError } = await admin.auth.admin.createUser({
        email: u.email.trim().toLowerCase(),
        password: u.password,
        email_confirm: true,
        user_metadata: {
          display_name: u.display_name.trim(),
          role: 'competitor',
        },
      });

      if (createError) {
        results.push({ email: u.email, success: false, error: createError.message });
        continue;
      }

      const userId = data.user.id;

      // Ensure profile exists before creating class/group memberships.
      // In some environments this can race with the auth.users trigger.
      const { error: profileUpsertError } = await admin.from('profiles').upsert(
        {
          id: userId,
          email: u.email.trim().toLowerCase(),
          display_name: u.display_name.trim(),
          role: 'competitor',
        },
        { onConflict: 'id' }
      );

      if (profileUpsertError) {
        results.push({ email: u.email, success: false, error: `Usuário criado, mas perfil falhou: ${profileUpsertError.message}`, userId });
        continue;
      }

      const linkErrors: string[] = [];

      // Add to class if provided
      if (u.class_id) {
        const { error: classMemberError } = await admin.from('class_members').upsert(
          {
            class_id: u.class_id,
            user_id: userId,
            status: 'active',
          },
          {
            onConflict: 'class_id,user_id',
            ignoreDuplicates: true,
          }
        );

        if (classMemberError) {
          linkErrors.push(`turma: ${classMemberError.message}`);
        }
      }

      // Add to group if provided
      if (u.group_id) {
        const { error: groupMemberError } = await admin.from('class_group_members').upsert(
          {
            group_id: u.group_id,
            user_id: userId,
          },
          {
            onConflict: 'group_id,user_id',
            ignoreDuplicates: true,
          }
        );

        if (groupMemberError) {
          linkErrors.push(`grupo: ${groupMemberError.message}`);
        }
      }

      if (linkErrors.length > 0) {
        results.push({ email: u.email, success: false, error: `Usuário criado, mas vínculo falhou (${linkErrors.join(' | ')})`, userId });
        continue;
      }

      results.push({ email: u.email, success: true, userId });
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({ results, succeeded, failed });
  } catch (err: any) {
    console.error('Bulk register API error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
