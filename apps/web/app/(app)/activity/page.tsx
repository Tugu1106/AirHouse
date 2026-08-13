import { listActivity, listEmployees, listBranches, type ActivityEntry } from '@airlink/core';
import { ActivityView, type ActivityRow } from '@/components/ActivityView';

export const dynamic = 'force-dynamic';

export default async function ActivityPage() {
  const [activity, employees, branches] = await Promise.all([
    listActivity(300),
    listEmployees(undefined, true), // include deleted so names still resolve
    listBranches(),
  ]);

  const empName = (id: string | null) => (id ? (employees.find((e) => e.id === id)?.name ?? '—') : '—');
  const brName = (id: string | null) => (id ? (branches.find((b) => b.id === id)?.name ?? '—') : '—');

  const target = (e: ActivityEntry): { label: string; href?: string } => {
    const d = (e.diff ?? {}) as { name?: string };
    if (e.entity_type === 'employee') {
      return {
        label: `Employee · ${e.employee_name ?? d.name ?? '—'}`,
        href: e.entity_id ? `/employees/${e.entity_id}` : undefined,
      };
    }
    if (e.entity_type === 'branch') {
      return {
        label: `Branch · ${e.branch_name ?? d.name ?? '—'}`,
        href: e.branch_name && e.entity_id ? `/branch/${e.entity_id}` : undefined,
      };
    }
    if (e.entity_type === 'user') {
      const du = (e.diff ?? {}) as { email?: string };
      return { label: `Admin · ${du.email ?? '—'}` };
    }
    return {
      label: `${e.item_type ?? 'item'}${e.item_name ? ` · ${e.item_name}` : ''}`,
      href: e.item_id ? `/item/${e.item_id}` : undefined,
    };
  };

  const detail = (e: ActivityEntry): string => {
    if (e.entity_type === 'item' && (e.action === 'transfer' || e.action === 'create')) {
      if (!e.from_employee_id && e.to_employee_id) return `Assigned to ${empName(e.to_employee_id)}`;
      if (e.from_employee_id && !e.to_employee_id) return `Unassigned from ${empName(e.from_employee_id)}`;
      if (e.from_employee_id && e.to_employee_id)
        return `${empName(e.from_employee_id)} → ${empName(e.to_employee_id)}`;
      if (e.action === 'transfer' && (e.from_branch_id || e.to_branch_id))
        return `Branch: ${brName(e.from_branch_id)} → ${brName(e.to_branch_id)}`;
    }
    const d = (e.diff ?? {}) as { login?: string; changed?: string[] };
    if (d.login) return `Login ${d.login}`;
    if (d.changed?.length) return `Changed: ${d.changed.join(', ')}`;
    return '';
  };

  const rows: ActivityRow[] = activity.map((e) => {
    const t = target(e);
    return {
      id: e.id,
      when: e.created_at,
      actor: e.actor_email ?? '—',
      action: e.action,
      entity: e.entity_type,
      target: t.label,
      targetHref: t.href,
      detail: detail(e),
    };
  });

  return <ActivityView rows={rows} />;
}
