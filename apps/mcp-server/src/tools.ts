// MCP tool definitions. Each tool is a thin wrapper over @airlink/core — no
// business logic here (validation, audit, soft-delete all live in core), so a
// tool call and the equivalent web-form action produce identical DB state.

import {
  addItem,
  updateItem,
  transferItem,
  softDeleteItem,
  restoreItem,
  listItems,
  listBranches,
  listEmployees,
  listItemTypes,
  createBranch,
  updateBranch,
  setBranchAsHq,
  createEmployee,
  updateEmployee,
  findBranchByName,
  findEmployeeByName,
  EMPLOYEE_STATUSES,
  type ItemStatus,
  type EmployeeStatus,
} from '@airlink/core';

const EMPLOYEE_STATUS_KEYS = EMPLOYEE_STATUSES.map((s) => s.key);

export interface ToolContext {
  actorId: string;
}

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<string>;
}

const str = (v: unknown): string => (v == null ? '' : String(v)).trim();

async function resolveEmployeeId(
  value: unknown,
  branchId?: string,
): Promise<string | null | undefined> {
  if (value === undefined) return undefined; // leave unchanged
  const s = str(value).toLowerCase();
  if (value === null || s === '' || s === 'none' || s === 'unassigned' || s === 'nobody') {
    return null; // explicit unassign
  }
  const emp = await findEmployeeByName(str(value), branchId);
  return emp.id;
}

export const TOOLS: ToolDef[] = [
  {
    name: 'list_branches',
    description: 'List all branches (id + name). Use to see available locations.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const branches = await listBranches();
      if (branches.length === 0) return 'No branches yet.';
      return branches.map((b) => `- ${b.name} (id: ${b.id})`).join('\n');
    },
  },
  {
    name: 'list_employees',
    description: 'List employees, optionally filtered by branch name.',
    inputSchema: {
      type: 'object',
      properties: {
        branch: { type: 'string', description: 'Optional branch name to filter by.' },
      },
    },
    handler: async (args) => {
      let branchId: string | undefined;
      if (str(args.branch)) branchId = (await findBranchByName(str(args.branch))).id;
      const emps = await listEmployees(branchId);
      if (emps.length === 0) return 'No employees found.';
      return emps.map((e) => `- ${e.name} (id: ${e.id})`).join('\n');
    },
  },
  {
    name: 'list_item_types',
    description:
      'List supported item types and the type-specific fields each one expects in `properties`. Call this before add_item if unsure what fields a type needs.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      return listItemTypes()
        .map((t) => {
          const fields = t.fields
            .map((f) => `${f.key}${f.required ? '*' : ''} (${f.type})`)
            .join(', ');
          return `- ${t.key} — ${t.label}: ${fields}`;
        })
        .join('\n');
    },
  },
  {
    name: 'list_items',
    description:
      'List/search items. Filter by branch name, type, status, assignee name, or a free-text search (matches serial/model). Returns item ids needed for transfer/delete.',
    inputSchema: {
      type: 'object',
      properties: {
        branch: { type: 'string', description: 'Branch name.' },
        type: { type: 'string', description: 'Item type key, e.g. pc, monitor, cable.' },
        status: { type: 'string', enum: ['active', 'in_repair', 'retired', 'lost'] },
        assignee: { type: 'string', description: 'Employee name.' },
        search: { type: 'string', description: 'Free text (serial, model, etc.).' },
      },
    },
    handler: async (args) => {
      const branchId = str(args.branch) ? (await findBranchByName(str(args.branch))).id : undefined;
      const assignedTo = str(args.assignee)
        ? (await findEmployeeByName(str(args.assignee))).id
        : undefined;
      const rows = await listItems({
        branchId,
        type: str(args.type) || undefined,
        status: (str(args.status) as ItemStatus) || undefined,
        assignedTo,
        search: str(args.search) || undefined,
      });
      if (rows.length === 0) return 'No matching items.';
      return rows
        .map((r) => {
          const label = [r.properties.serial, r.properties.model].filter(Boolean).join(' ') || '—';
          return `- [${r.type}] ${label} · ${r.branch?.name ?? '?'} · ${
            r.assignee?.name ?? 'Unassigned'
          } · ${r.status} (id: ${r.id})`;
        })
        .join('\n');
    },
  },
  {
    name: 'add_item',
    description:
      'Add a new hardware item. branch is required (by name). assignee optional (by name). properties holds type-specific fields (see list_item_types).',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Item type key, e.g. pc, monitor, cable, printer.' },
        branch: { type: 'string', description: 'Branch name the item lives at.' },
        assignee: { type: 'string', description: 'Optional employee name to assign it to.' },
        status: {
          type: 'string',
          enum: ['active', 'in_repair', 'retired', 'lost'],
          description: 'Defaults to active.',
        },
        properties: {
          type: 'object',
          description: 'Type-specific fields, e.g. { "serial": "PC-014", "cpu": "i5" }.',
        },
      },
      required: ['type', 'branch'],
    },
    handler: async (args, ctx) => {
      const branch = await findBranchByName(str(args.branch));
      const assignedTo =
        str(args.assignee) !== '' ? (await findEmployeeByName(str(args.assignee), branch.id)).id : null;
      const item = await addItem(
        {
          type: str(args.type),
          branch_id: branch.id,
          assigned_to: assignedTo,
          status: (str(args.status) as ItemStatus) || undefined,
          properties: (args.properties as Record<string, unknown>) ?? {},
        },
        ctx,
      );
      return `Added ${item.type} (id: ${item.id}) to ${branch.name}${
        assignedTo ? `, assigned to ${str(args.assignee)}` : ''
      }.`;
    },
  },
  {
    name: 'transfer_item',
    description:
      'Reassign an item to a different employee and/or move it to a different branch. Get item_id from list_items. Pass to_employee="none" to unassign.',
    inputSchema: {
      type: 'object',
      properties: {
        item_id: { type: 'string', description: 'The item id (from list_items).' },
        to_employee: {
          type: 'string',
          description: 'New assignee name, or "none" to unassign. Omit to leave unchanged.',
        },
        to_branch: { type: 'string', description: 'New branch name. Omit to keep current branch.' },
      },
      required: ['item_id'],
    },
    handler: async (args, ctx) => {
      const toBranch = str(args.to_branch) ? await findBranchByName(str(args.to_branch)) : undefined;
      const toEmployeeId = await resolveEmployeeId(
        'to_employee' in args ? args.to_employee : undefined,
        toBranch?.id,
      );
      const input: { toEmployeeId?: string | null; toBranchId?: string } = {};
      if (toEmployeeId !== undefined) input.toEmployeeId = toEmployeeId;
      if (toBranch) input.toBranchId = toBranch.id;
      await transferItem(str(args.item_id), input, ctx);
      return `Transferred item ${str(args.item_id)}${
        toBranch ? ` to ${toBranch.name}` : ''
      }${toEmployeeId !== undefined ? ` (assignee updated)` : ''}.`;
    },
  },
  {
    name: 'soft_delete_item',
    description:
      'Soft-delete an item (marks it deleted but keeps full history; never hard-deletes). Get item_id from list_items.',
    inputSchema: {
      type: 'object',
      properties: { item_id: { type: 'string', description: 'The item id (from list_items).' } },
      required: ['item_id'],
    },
    handler: async (args, ctx) => {
      await softDeleteItem(str(args.item_id), ctx);
      return `Soft-deleted item ${str(args.item_id)}. It remains in history and can be restored from the web app.`;
    },
  },
  {
    name: 'add_employee',
    description:
      'Create an employee. name is required; branch (by name), phone, position and status are optional.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Full name.' },
        branch: { type: 'string', description: 'Branch name the employee works at.' },
        phone: { type: 'string', description: 'Mobile phone number.' },
        position: { type: 'string', description: 'Job title / position.' },
        status: {
          type: 'string',
          enum: EMPLOYEE_STATUS_KEYS,
          description: 'Defaults to active.',
        },
      },
      required: ['name'],
    },
    handler: async (args) => {
      const branchId = str(args.branch) ? (await findBranchByName(str(args.branch))).id : null;
      const emp = await createEmployee({
        name: str(args.name),
        branchId,
        phone: str(args.phone) || null,
        position: str(args.position) || null,
        status: (str(args.status) as EmployeeStatus) || undefined,
      });
      return `Added employee ${emp.name} (id: ${emp.id})${str(args.branch) ? ` at ${str(args.branch)}` : ''}.`;
    },
  },
  {
    name: 'update_employee',
    description:
      'Update an existing employee (found by name). Change their status (e.g. fired, on_leave), phone, position, or branch.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Current name of the employee to update.' },
        new_name: { type: 'string', description: 'New name, if renaming.' },
        status: { type: 'string', enum: EMPLOYEE_STATUS_KEYS },
        phone: { type: 'string' },
        position: { type: 'string' },
        branch: { type: 'string', description: 'New branch name.' },
      },
      required: ['name'],
    },
    handler: async (args) => {
      const emp = await findEmployeeByName(str(args.name));
      const patch: {
        name?: string;
        status?: EmployeeStatus;
        phone?: string;
        position?: string;
        branchId?: string;
      } = {};
      if (str(args.new_name)) patch.name = str(args.new_name);
      if (str(args.status)) patch.status = str(args.status) as EmployeeStatus;
      if (str(args.phone)) patch.phone = str(args.phone);
      if (str(args.position)) patch.position = str(args.position);
      if (str(args.branch)) patch.branchId = (await findBranchByName(str(args.branch))).id;
      await updateEmployee(emp.id, patch);
      return `Updated employee ${emp.name}.`;
    },
  },
  {
    name: 'update_item',
    description:
      "Update an item's status and/or type-specific properties. Get item_id from list_items.",
    inputSchema: {
      type: 'object',
      properties: {
        item_id: { type: 'string' },
        status: { type: 'string', enum: ['active', 'in_repair', 'retired', 'lost'] },
        properties: { type: 'object', description: 'Type-specific fields to change.' },
      },
      required: ['item_id'],
    },
    handler: async (args, ctx) => {
      const patch: { status?: ItemStatus; properties?: Record<string, unknown> } = {};
      if (str(args.status)) patch.status = str(args.status) as ItemStatus;
      if (args.properties) patch.properties = args.properties as Record<string, unknown>;
      await updateItem(str(args.item_id), patch, ctx);
      return `Updated item ${str(args.item_id)}.`;
    },
  },
  {
    name: 'restore_item',
    description: 'Restore a soft-deleted item. Get item_id from list_items (with deleted shown).',
    inputSchema: {
      type: 'object',
      properties: { item_id: { type: 'string' } },
      required: ['item_id'],
    },
    handler: async (args, ctx) => {
      await restoreItem(str(args.item_id), ctx);
      return `Restored item ${str(args.item_id)}.`;
    },
  },
  {
    name: 'add_branch',
    description: 'Create a new branch.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Branch name.' } },
      required: ['name'],
    },
    handler: async (args) => {
      const b = await createBranch(str(args.name));
      return `Added branch "${b.name}" (id: ${b.id}).`;
    },
  },
  {
    name: 'rename_branch',
    description: 'Rename a branch (found by its current name).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Current branch name.' },
        new_name: { type: 'string', description: 'New name.' },
      },
      required: ['name', 'new_name'],
    },
    handler: async (args) => {
      const b = await findBranchByName(str(args.name));
      await updateBranch(b.id, { name: str(args.new_name) });
      return `Renamed "${b.name}" to "${str(args.new_name)}".`;
    },
  },
  {
    name: 'set_central_branch',
    description: 'Mark a branch as the central/HQ branch, clearing the flag from any other.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Branch name.' } },
      required: ['name'],
    },
    handler: async (args) => {
      const b = await findBranchByName(str(args.name));
      await setBranchAsHq(b.id);
      return `"${b.name}" is now the central branch.`;
    },
  },
];

export const TOOLS_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));
