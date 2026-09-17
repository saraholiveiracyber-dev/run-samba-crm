/* =========================================================
   RUN & SAMBA 2026
   CRM
   AUTENTICAÇÃO
   SUPABASE AUTH
   ========================================================= */

"use strict";


/* =========================================================
   CRM AUTH
   ========================================================= */

window.crmAuth = {

    /* =====================================================
       VERIFICAR AUTENTICAÇÃO
       ===================================================== */

    async requireAuth() {

        try {

            if (!window.supabaseClient) {

                console.error(
                    "Supabase Client não foi carregado."
                );

                window.location.href = "index.html";

                return null;
            }


            const {
                data,
                error
            } =
                await window.supabaseClient.auth.getSession();


            if (error) {

                console.error(
                    "Erro ao verificar sessão:",
                    error
                );

                window.location.href = "index.html";

                return null;
            }


            if (!data || !data.session) {

                window.location.href = "index.html";

                return null;
            }


            return data.session;

        } catch (error) {

            console.error(
                "Erro na autenticação:",
                error
            );

            window.location.href = "index.html";

            return null;
        }
    },


    /* =====================================================
       LOGIN
       ===================================================== */

    async signIn(email, password) {

        try {

            if (!window.supabaseClient) {

                return {
                    data: {
                        user: null,
                        session: null
                    },
                    error: new Error(
                        "Supabase Client não foi carregado."
                    )
                };
            }


            email =
                String(email || "")
                    .trim()
                    .toLowerCase();


            password =
                String(password || "");


            if (!email || !password) {

                return {
                    data: {
                        user: null,
                        session: null
                    },
                    error: new Error(
                        "Informe o e-mail e a senha."
                    )
                };
            }


            const response =
                await window.supabaseClient.auth
                    .signInWithPassword({
                        email,
                        password
                    });


            return response;

        } catch (error) {

            console.error(
                "Erro ao realizar login:",
                error
            );

            return {
                data: {
                    user: null,
                    session: null
                },
                error
            };
        }
    },


    /* =====================================================
       LOGOUT
       ===================================================== */

    async signOut() {

        try {

            if (window.supabaseClient) {

                const {
                    error
                } =
                    await window.supabaseClient.auth
                        .signOut();


                if (error) {

                    console.error(
                        "Erro ao sair:",
                        error
                    );
                }
            }

        } catch (error) {

            console.error(
                "Erro no logout:",
                error
            );

        } finally {

            window.location.href =
                "index.html";
        }
    }

};


/* =========================================================
   OBSERVAR ESTADO DA AUTENTICAÇÃO
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        /* ================================================
           BOTÃO LOGOUT
           ================================================ */

        const logoutBtn =
            document.getElementById("logoutBtn");


        if (logoutBtn) {

            logoutBtn.addEventListener(
                "click",
                async () => {

                    logoutBtn.disabled =
                        true;

                    await window.crmAuth.signOut();

                }
            );
        }


        /* ================================================
           LOG DE ESTADO DO SUPABASE
           ================================================ */

        if (
            window.supabaseClient &&
            window.supabaseClient.auth
        ) {

            window.supabaseClient.auth
                .onAuthStateChange(
                    (event, session) => {

                        console.log(
                            "Auth:",
                            event
                        );

                    }
                );
        }

    }
);