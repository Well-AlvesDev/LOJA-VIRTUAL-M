// supabase/functions/criar-preferencia/index.ts
// Edge Function — Cria uma Preferência no Mercado Pago para PIX com QR Code
//
// Variáveis de ambiente necessárias (definidas no painel do Supabase):
//   MP_ACCESS_TOKEN  — seu Access Token do Mercado Pago (ex: APP_USR-xxx ou TEST-xxx)
//   STORE_URL        — URL base da loja (ex: https://donaflor.com.br)

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // Responder ao preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");
    const STORE_URL = Deno.env.get("STORE_URL") ?? "https://donaflor-modafeminina.vercel.app/";

    if (!MP_ACCESS_TOKEN) {
      throw new Error("MP_ACCESS_TOKEN não configurado nas variáveis de ambiente.");
    }

    const { titulo, preco, produtoId } = await req.json();

    if (!titulo || !preco || !produtoId) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios ausentes: titulo, preco, produtoId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Monta o body da preferência com PIX como método principal
    const preferenceBody = {
      items: [
        {
          id: String(produtoId),
          title: titulo,
          quantity: 1,
          unit_price: Number(preco),
          currency_id: "BRL",
        },
      ],
      // URLs de retorno após pagamento (PIX com QR code não requer email)
      back_urls: {
        success: `${STORE_URL}/pagamento/sucesso`,
        failure: `${STORE_URL}/pagamento/falha`,
        pending: `${STORE_URL}/pagamento/pendente`,
      },
      auto_return: "approved",
      // Webhook de notificação para PIX (recomendado)
      notification_url: `${STORE_URL}/api/mp-webhook`,
      payment_methods: {
        // PIX é processado via bankTransfer no Payment Brick
        installments: 12,
        // Excluir boleto para focar em PIX
        excluded_payment_methods: [
          { id: "ticket" } // Desabilita boleto
        ],
      },
      expires: false,
    };

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preferenceBody),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("Erro MP:", mpData);
      throw new Error(mpData.message ?? "Erro ao criar preferência no Mercado Pago");
    }

    return new Response(
      JSON.stringify({ preferenceId: mpData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("criar-preferencia error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});