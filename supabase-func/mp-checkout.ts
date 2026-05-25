// ============================================================
//  Supabase Edge Function — Mercado Pago Checkout
//  Rota: POST /functions/v1/mp-checkout
//  Body esperado: { action, ...payload }
//  actions: "create_order" | "get_order" | "create_pix"
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const MP_BASE_URL = "https://api.mercadopago.com";
const ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---------- helpers ----------
function mpHeaders() {
  return {
    Authorization: `Bearer ${ACCESS_TOKEN}`,
    "Content-Type": "application/json",
    "X-Idempotency-Key": crypto.randomUUID(),
  };
}

async function mpFetch(path: string, body: unknown) {
  const res = await fetch(`${MP_BASE_URL}${path}`, {
    method: "POST",
    headers: mpHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, detail: data };
  return data;
}

// ---------- actions ----------

/** Cartão de crédito/débito via API Orders */
async function createOrder(payload: {
  amount: number;
  description: string;
  token: string;          // token gerado pelo Brick / SDK MP no frontend
  installments: number;
  paymentMethodId: string;
  payerEmail: string;
  payerName: string;
  payerDocType: string;
  payerDocNumber: string;
  isDebit?: boolean;
}) {
  const body = {
    type: "online",
    processing_mode: "automatic",
    total_amount: String(payload.amount.toFixed(2)),
    payer: {
      email: payload.payerEmail,
      identification: { type: payload.payerDocType, number: payload.payerDocNumber },
    },
    transactions: {
      payments: [
        {
          amount: String(payload.amount.toFixed(2)),
          payment_method: {
            id: payload.paymentMethodId,
            type: payload.isDebit ? "debit_card" : "credit_card",
            token: payload.token,
            installments: payload.isDebit ? 1 : payload.installments,
            statement_descriptor: "DONA FLOR",
          },
        },
      ],
    },
    description: payload.description,
  };

  return mpFetch("/v1/orders", body);
}

/** PIX via Payments API (Orders ainda não suporta PIX nativamente) */
async function createPix(payload: {
  amount: number;
  description: string;
  payerEmail: string;
  payerName: string;
  payerDocType: string;
  payerDocNumber: string;
}) {
  const [firstName, ...rest] = payload.payerName.split(" ");
  const body = {
    transaction_amount: payload.amount,
    description: payload.description,
    payment_method_id: "pix",
    payer: {
      email: payload.payerEmail,
      first_name: firstName,
      last_name: rest.join(" ") || firstName,
      identification: { type: payload.payerDocType, number: payload.payerDocNumber },
    },
  };

  return mpFetch("/v1/payments", body);
}

/** Consultar status de um pedido/pagamento */
async function getOrderStatus(orderId: string, type: "order" | "payment" = "order") {
  const path = type === "payment" ? `/v1/payments/${orderId}` : `/v1/orders/${orderId}`;
  const res = await fetch(`${MP_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, detail: data };
  return data;
}

// ---------- handler ----------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { action, ...payload } = await req.json();

    let result: unknown;

    switch (action) {
      case "create_order":
        result = await createOrder(payload as Parameters<typeof createOrder>[0]);
        break;
      case "create_pix":
        result = await createPix(payload as Parameters<typeof createPix>[0]);
        break;
      case "get_status": {
        const { id, type } = payload as { id: string; type: "order" | "payment" };
        result = await getOrderStatus(id, type);
        break;
      }
      default:
        return new Response(JSON.stringify({ error: "Ação inválida" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const e = err as { status?: number; detail?: unknown; message?: string };
    console.error("MP Error:", JSON.stringify(e));
    return new Response(JSON.stringify({ error: e.detail ?? e.message ?? "Erro interno" }), {
      status: e.status ?? 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});