import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export type AgentActionType =
    | 'publish_ebay_draft'
    | 'update_ebay_price'
    | 'list_shortboxed'
    | 'submit_heritage'
    | 'needs_photos';

export interface AgentAction {
    id: string;
    createdAt: string;
    type: AgentActionType;
    status: 'pending' | 'approved' | 'dismissed';
    priority: 1 | 2 | 3;   // 1=urgent, 2=normal, 3=fyi
    marvelId: string;
    comicTitle: string;
    details: Record<string, any>;
}

const ACTIONS_PATH = path.join(process.cwd(), 'data', 'agent-actions.jsonl');

export function readActions(): AgentAction[] {
    if (!fs.existsSync(ACTIONS_PATH)) return [];
    return fs.readFileSync(ACTIONS_PATH, 'utf-8')
        .split('\n')
        .filter(Boolean)
        .map(line => {
            try { return JSON.parse(line) as AgentAction; }
            catch { return null; }
        })
        .filter((e): e is AgentAction => e !== null);
}

function writeActions(actions: AgentAction[]): void {
    fs.writeFileSync(ACTIONS_PATH, actions.map(a => JSON.stringify(a)).join('\n') + '\n');
}

/**
 * Upsert by marvelId + type.
 * - If a pending action exists with same marvelId+type: update it in place.
 * - If dismissed or approved: leave it alone, do NOT create a new one.
 * - If no existing action: create a new one.
 */
export function upsertAction(action: Omit<AgentAction, 'id' | 'createdAt' | 'status'>): AgentAction {
    const actions = readActions();
    const existing = actions.find(
        a => a.marvelId === action.marvelId && a.type === action.type
    );

    if (existing) {
        if (existing.status === 'dismissed' || existing.status === 'approved') {
            return existing; // leave alone
        }
        // Update pending in place
        const updated: AgentAction = {
            ...existing,
            priority: action.priority,
            comicTitle: action.comicTitle,
            details: action.details,
        };
        const idx = actions.findIndex(a => a.id === existing.id);
        actions[idx] = updated;
        writeActions(actions);
        return updated;
    }

    const newAction: AgentAction = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        status: 'pending',
        ...action,
    };
    actions.push(newAction);
    writeActions(actions);
    return newAction;
}

export function updateAction(id: string, patch: Partial<AgentAction>): AgentAction | null {
    const actions = readActions();
    const idx = actions.findIndex(a => a.id === id);
    if (idx === -1) return null;
    actions[idx] = { ...actions[idx], ...patch };
    writeActions(actions);
    return actions[idx];
}

export function pendingActions(): AgentAction[] {
    return readActions().filter(a => a.status === 'pending');
}
