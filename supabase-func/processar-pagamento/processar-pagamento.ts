// supabase/functions/processar-pagamento/index.ts
// Edge Function — Processa o pagamento (usado pelo Payment Brick via onSubmit)
//
// Variáveis de ambiente necessárias:
//   MP_ACCESS_TOKEN  — seu Access Token do Mercado Pago
//   SUPABASE_URL     — URL do seu projeto Supabase   (automática no runtime)
//   SUPABASE_SERVICE_ROLE_KEY — chave service_role   (automática no runtime)

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");

    if (!MP_ACCESS_TOKEN) {
      throw new Error("MP_ACCESS_TOKEN não configurado.");
    }

    // O Brick envia o formData diretamente via onSubmit
    const formData = await req.json();

    // Enviar para a API de pagamentos do Mercado Pago
    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        // Idempotência para evitar cobranças duplicadas em caso de retry
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(formData),
    });

    const payment = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("Erro MP pagamento:", payment);
      throw new Error(payment.message ?? "Erro ao processar pagamento");
    }

    // ── Opcional: salvar pedido no Supabase ──────────────────────────────────
    // Descomente e ajuste a tabela conforme seu schema
    //
    // const supabase = createClient(
    //   Deno.env.get("SUPABASE_URL")!,
    //   Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    // );
    // await supabase.from("pedidos").insert({
    //   mp_payment_id: payment.id,
    //   status: payment.status,
    //   valor: payment.transaction_amount,
    //   produto_id: payment.additional_info?.items?.[0]?.id ?? null,
    //   produto_nome: payment.additional_info?.items?.[0]?.title ?? null,
    //   criado_em: new Date().toISOString(),
    // });
    // ────────────────────────────────────────────────────────────────────────

    return new Response(
      JSON.stringify({
        id: payment.id,
        status: payment.status,
        status_detail: payment.status_detail,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("processar-pagamento error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});