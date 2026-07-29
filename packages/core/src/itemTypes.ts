// ===========================================================================
// Item-type registry
// ===========================================================================
// The ONLY place to touch to add/adjust a kind of hardware. Because
// items.properties is JSONB, changes here need no database migration — the web
// forms, the item detail view, and the MCP tools all read from this registry.
//
// Note: an item's "owner" is NOT a property here — it's the assigned employee
// (items.assigned_to), managed via the assignee/transfer system.
// ===========================================================================

import { z } from 'zod';

export type ItemFieldType = 'text' | 'number' | 'textarea' | 'select';

export interface ItemTypeField {
  key: string; // stored inside items.properties
  label: string; // shown in the form
  type: ItemFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[]; // for type: 'select'
  /** If true, the item detail view hides this field when it has no value
   *  (for optional specs that only some units have). */
  hideWhenEmpty?: boolean;
}

export interface ItemTypeDef {
  key: string; // stored in items.type (stable, lowercase)
  label: string; // human label
  fields: ItemTypeField[];
}

// Desktops and laptops share the same spec sheet. Standard specs are always
// shown (blank if unknown).
const COMPUTER_FIELDS: ItemTypeField[] = [
  { key: 'model', label: 'Model name', type: 'text', required: true },
  { key: 'system_name', label: 'System name', type: 'text', placeholder: 'e.g. PC-014' },
  { key: 'cpu', label: 'CPU', type: 'text', placeholder: 'e.g. i5-11500' },
  { key: 'ram', label: 'RAM', type: 'text', placeholder: 'e.g. 16GB' },
  { key: 'storage', label: 'Hard drive', type: 'text', placeholder: 'e.g. 512GB SSD' },
  { key: 'os', label: 'Operating system', type: 'text', placeholder: 'e.g. Windows 11 Pro' },
];

// Mice and keyboards share the same fields.
const INPUT_DEVICE_FIELDS: ItemTypeField[] = [
  { key: 'model', label: 'Model name', type: 'text', required: true },
  { key: 'condition', label: 'Condition', type: 'select', options: ['new', 'old'] },
  { key: 'wiring', label: 'Wiring', type: 'select', options: ['wired', 'wireless'] },
  { key: 'color', label: 'Color', type: 'select', options: ['white', 'black'] },
];

export const ITEM_TYPES: ItemTypeDef[] = [
  { key: 'desktop', label: 'Desktop', fields: COMPUTER_FIELDS },
  { key: 'laptop', label: 'Laptop', fields: COMPUTER_FIELDS },
  {
    key: 'monitor',
    label: 'Monitor',
    fields: [
      { key: 'serial', label: 'Serial number', type: 'text' },
      { key: 'model', label: 'Model', type: 'text' },
      { key: 'size_inches', label: 'Size (inches)', type: 'number', placeholder: 'e.g. 24' },
    ],
  },
  { key: 'mouse', label: 'Mouse', fields: INPUT_DEVICE_FIELDS },
  { key: 'keyboard', label: 'Keyboard', fields: INPUT_DEVICE_FIELDS },
  {
    key: 'printer',
    label: 'Printer',
    fields: [
      { key: 'model', label: 'Model name', type: 'text', required: true },
      { key: 'ink_type', label: 'Ink type', type: 'select', options: ['laser', 'color'] },
      { key: 'connection', label: 'Connection', type: 'select', options: ['usb', 'lan', 'wifi'] },
    ],
  },
  {
    key: 'cable',
    label: 'Cable',
    fields: [
      {
        key: 'cable_type',
        label: 'Cable type',
        type: 'select',
        required: true,
        options: ['ethernet', 'hdmi', 'displayport', 'vga', 'power', 'usb', 'other'],
      },
      { key: 'length_m', label: 'Length (m)', type: 'number', placeholder: 'e.g. 2' },
    ],
  },
  {
    key: 'lan_switch',
    label: 'LAN switch',
    fields: [
      { key: 'serial', label: 'Serial number', type: 'text', required: true },
      { key: 'model', label: 'Model', type: 'text' },
      { key: 'ports', label: 'Port count', type: 'number', placeholder: 'e.g. 24' },
    ],
  },
];

const BY_KEY = new Map(ITEM_TYPES.map((t) => [t.key, t]));

export function listItemTypes(): ItemTypeDef[] {
  return ITEM_TYPES;
}

export function getItemType(key: string): ItemTypeDef | undefined {
  return BY_KEY.get(key);
}

// ---------------------------------------------------------------------------
// Validation: derive a Zod schema from a type's fields.
// ---------------------------------------------------------------------------
function fieldSchema(f: ItemTypeField): z.ZodTypeAny {
  if (f.type === 'number') {
    const num = z.coerce.number({ invalid_type_error: `${f.label} must be a number` });
    return f.required
      ? num
      : z.preprocess((v) => (v === '' || v == null ? undefined : v), num.optional());
  }
  if (f.type === 'select' && f.options && f.options.length > 0) {
    const en = z.enum(f.options as [string, ...string[]]);
    return f.required
      ? en
      : z.preprocess((v) => (v === '' || v == null ? undefined : v), en.optional());
  }
  const str = z.string();
  return f.required ? str.min(1, `${f.label} is required`) : str.optional();
}

/**
 * Validate + normalize a properties object for a given item type. Throws a
 * ZodError if required fields are missing or values are the wrong shape.
 * Unknown extra keys are stripped.
 */
export function validateProperties(
  typeKey: string,
  properties: Record<string, unknown>,
): Record<string, unknown> {
  const def = getItemType(typeKey);
  if (!def) throw new Error(`Unknown item type: ${typeKey}`);
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of def.fields) shape[f.key] = fieldSchema(f);
  const parsed = z.object(shape).parse(properties ?? {});
  return Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== undefined));
}
