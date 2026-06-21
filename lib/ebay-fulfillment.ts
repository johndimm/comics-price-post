import fs from 'fs';
import path from 'path';

const API_BASE = 'https://api.ebay.com';

export interface EbayOrder {
    orderId: string;
    creationDate: string;
    buyerUsername: string;
    buyerName: string;
    shipTo: string;       // full formatted address
    shipByDate: string | null;
    lineItems: {
        title: string;
        sku: string | null;
        legacyItemId: string;
        price: string;
    }[];
    totalPrice: string;
}

export async function getNewOrders(token: string, createdAfter: string): Promise<EbayOrder[]> {
    const url = `${API_BASE}/sell/fulfillment/v1/order?filter=creationdate:[${createdAfter}..],orderfulfillmentstatus:{NOT_STARTED|IN_PROGRESS}&limit=50`;
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept-Language': 'en-US' },
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Fulfillment API error: ${res.status} ${err}`);
    }
    const data = await res.json() as any;
    const orders: EbayOrder[] = [];

    for (const o of (data.orders ?? [])) {
        const shipStep = o.fulfillmentStartInstructions?.[0]?.shippingStep;
        const addr = shipStep?.shipTo?.contactAddress;
        const shipTo = addr
            ? [addr.addressLine1, addr.addressLine2, addr.city, addr.stateOrProvince, addr.postalCode, addr.countryCode]
                .filter(Boolean).join(', ')
            : 'Address not available';

        orders.push({
            orderId: o.orderId,
            creationDate: o.creationDate,
            buyerUsername: o.buyer?.username ?? '',
            buyerName: shipStep?.shipTo?.fullName ?? o.buyer?.username ?? '',
            shipTo,
            shipByDate: o.lineItems?.[0]?.lineItemFulfillmentInstructions?.shipByDate ?? null,
            lineItems: (o.lineItems ?? []).map((li: any) => ({
                title: li.title ?? '',
                sku: li.sku ?? null,
                legacyItemId: li.legacyItemId ?? '',
                price: li.total?.value ?? '',
            })),
            totalPrice: o.pricingSummary?.total?.value ?? '',
        });
    }
    return orders;
}

// Persist agent state (last poll cursor, processed email UIDs)
const STATE_PATH = path.join(process.cwd(), 'data', 'agent-state.json');

interface AgentState {
    lastOrderCreatedAfter: string;
    processedEmailUids: number[];
}

export function readAgentState(): AgentState {
    if (!fs.existsSync(STATE_PATH)) {
        return {
            lastOrderCreatedAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            processedEmailUids: [],
        };
    }
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
}

export function writeAgentState(state: AgentState): void {
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}
