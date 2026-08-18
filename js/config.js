// CONFIGURAÇÃO SUPABASE
// Use somente a chave ANON/PUBLIC.
// Nunca coloque a service_role key aqui.

window.SUPABASE_URL =
    "https://tqezxxobxsipjjuyydvc.supabase.co";

window.SUPABASE_ANON_KEY =
    "sb_publishable_Yt-DyfGqRqfbPN6aPgLM5w_K2RIneDd";

window.supabaseClient =
    window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_ANON_KEY
    );