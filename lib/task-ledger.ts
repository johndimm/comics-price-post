import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

export interface TaskEntry {
    id: string;
    createdAt: string;
    dueAt: string | null;
    status: 'open' | 'done' | 'dismissed';
    completedAt: string | null;
    type: 'ship_ebay' | 'ship_shortboxed' | 'end_ebay' | 'manual' | 'grade';
    title: string;
    source: 'ebay_order' | 'shortboxed_email' | 'manual';
    marvelId: string | null;
    comicTitle: string;
    salePrice: string | null;
    buyerName: string | null;
    buyerAddress: string | null;
    ebayOrderId: string | null;
    ebayItemId: string | null;
    ebayOfferId: string | null;
    shortboxedEmailUid: number | null;
}

const TASKS_PATH = path.join(process.cwd(), 'data', 'tasks.jsonl');

export function readTasks(): TaskEntry[] {
    if (!fs.existsSync(TASKS_PATH)) return [];
    return fs.readFileSync(TASKS_PATH, 'utf-8')
        .split('\n').filter(Boolean)
        .map(line => { try { return JSON.parse(line) as TaskEntry; } catch { return null; } })
        .filter((e): e is TaskEntry => e !== null);
}

export function appendTask(entry: Omit<TaskEntry, 'id' | 'createdAt' | 'completedAt'>): TaskEntry {
    const task: TaskEntry = {
        ...entry,
        id: 'task_' + randomBytes(4).toString('hex'),
        createdAt: new Date().toISOString(),
        completedAt: null,
    };
    fs.appendFileSync(TASKS_PATH, JSON.stringify(task) + '\n');
    return task;
}

export function updateTask(id: string, patch: Partial<TaskEntry>): void {
    const tasks = readTasks();
    const updated = tasks.map(t => t.id === id ? { ...t, ...patch } : t);
    fs.writeFileSync(TASKS_PATH, updated.map(t => JSON.stringify(t)).join('\n') + '\n');
}

export function taskExistsForOrder(ebayOrderId: string): boolean {
    return readTasks().some(t => t.ebayOrderId === ebayOrderId);
}

export function taskExistsForEmail(uid: number): boolean {
    return readTasks().some(t => t.shortboxedEmailUid === uid);
}
