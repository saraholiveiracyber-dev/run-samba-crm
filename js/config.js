"use strict";

// ==========================================
// RUN & SAMBA CRM — CONFIGURAÇÃO SUPABASE
// ==========================================

window.SUPABASE_URL =
    "https://tqezxxobxsipjjuyydvc.supabase.co";

window.SUPABASE_ANON_KEY =
    "sb_publishable_Yt-DyfGqRqfbPN6aPgLM5w_K2RIneDd";

// CLIENTE SUPABASE
if (!window.supabase) {
    console.error("Biblioteca Supabase não carregada.");
} else {
    window.supabaseClient = window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_ANON_KEY
    );
}

// ==========================================
// SITE PÚBLICO DE INSCRIÇÕES
// ==========================================

window.RUN_SAMBA_REGISTRATION_URL =
    "https://s7systems-runesamba.vercel.app/inscricoes.html";

// ==========================================
// LINK INDIVIDUAL DOS EMBAIXADORES
// ==========================================

window.gerarLinkEmbaixador = function (codigo) {
    if (!codigo) return "";

    return `${window.RUN_SAMBA_REGISTRATION_URL}?embaixador=${encodeURIComponent(
        codigo.trim().toUpperCase()
    )}`;
};
