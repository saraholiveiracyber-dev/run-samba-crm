/* =========================================================
   RUN & SAMBA 2026
   DASHBOARD
   ========================================================= */

"use strict";


/* =========================================================
   CONFIGURAÇÕES
   ========================================================= */

const VALOR_INSCRICAO = 89.90;


/* =========================================================
   CARREGAR DASHBOARD
   ========================================================= */

async function loadDashboard() {

    try {

        /* =====================================================
           AUTENTICAÇÃO
           ===================================================== */

        if (
            !window.crmAuth ||
            typeof window.crmAuth.requireAuth !== "function"
        ) {

            showMessage(
                "Sistema de autenticação não encontrado."
            );

            return;
        }


        const session =
            await window.crmAuth.requireAuth();


        if (!session) {
            return;
        }


        /* =====================================================
           SUPABASE
           ===================================================== */

        const db =
            window.supabaseClient;


        if (!db) {

            showMessage(
                "Supabase não foi inicializado."
            );

            return;
        }


        /* =====================================================
           BUSCAR INSCRIÇÕES
           ===================================================== */

        const {
            data,
            error
        } = await db
            .from("inscricoes")
            .select(`
                id,
                nome,
                cpf,
                telefone,
                camiseta,
                percurso,
                valor,
                status,
                status_pagamento,
                created_at
            `)
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


        if (error) {

            console.error(
                "Erro Supabase:",
                error
            );

            showMessage(
                "Erro ao carregar inscrições: " +
                error.message
            );

            return;
        }


        const rows =
            Array.isArray(data)
                ? data
                : [];


        /* =====================================================
           NORMALIZAÇÃO
           ===================================================== */

        const upper = (value) => {

            return String(
                value ?? ""
            )
                .trim()
                .toUpperCase();

        };


        /* =====================================================
           CLASSIFICAÇÃO DOS PAGAMENTOS
           
           IMPORTANTE:
           Cada inscrição pertence a apenas uma categoria.
           
           CANCELADO
           PAGO
           PENDENTE
           ===================================================== */

        const cancelledRows =
            rows.filter(row => {

                const pagamento =
                    upper(
                        row.status_pagamento
                    );

                const status =
                    upper(
                        row.status
                    );

                return (
                    pagamento === "CANCELADO" ||
                    status === "CANCELADO"
                );

            });


        const paidRows =
            rows.filter(row => {

                const pagamento =
                    upper(
                        row.status_pagamento
                    );

                const status =
                    upper(
                        row.status
                    );


                // Cancelado nunca pode ser considerado pago
                if (
                    pagamento === "CANCELADO" ||
                    status === "CANCELADO"
                ) {
                    return false;
                }


                return pagamento === "PAGO";

            });


        const pendingRows =
            rows.filter(row => {

                const pagamento =
                    upper(
                        row.status_pagamento
                    );

                const status =
                    upper(
                        row.status
                    );


                // Cancelado não é pendente
                if (
                    pagamento === "CANCELADO" ||
                    status === "CANCELADO"
                ) {
                    return false;
                }


                // Pago não é pendente
                if (
                    pagamento === "PAGO"
                ) {
                    return false;
                }


                // Vazio ou PENDENTE = pendente
                return (
                    pagamento === "" ||
                    pagamento === "PENDENTE"
                );

            });


        /* =====================================================
           CONTADORES
           ===================================================== */

        const total =
            rows.length;

        const paid =
            paidRows.length;

        const pending =
            pendingRows.length;

        const cancelled =
            cancelledRows.length;


        setText(
            "total",
            total
        );


        setText(
            "paid",
            paid
        );


        setText(
            "pending",
            pending
        );


        setText(
            "cancelled",
            cancelled
        );


        /* =====================================================
           FINANCEIRO
           ===================================================== */

        // Inscrições válidas = tudo menos cancelados
        const validInscricoes =
            Math.max(
                total - cancelled,
                0
            );


        // Valor previsto das inscrições válidas
        const totalValue =
            validInscricoes *
            VALOR_INSCRICAO;


        // Valor efetivamente recebido
        const paidValue =
            paid *
            VALOR_INSCRICAO;


        // Valor ainda pendente
        const pendingValue =
            pending *
            VALOR_INSCRICAO;


        // Valor correspondente aos cancelados
        const cancelledValue =
            cancelled *
            VALOR_INSCRICAO;


        /* =====================================================
           MOSTRAR VALORES
           ===================================================== */

        setMoney(
            "totalValue",
            totalValue
        );


        setMoney(
            "paidValue",
            paidValue
        );


        setMoney(
            "pendingValue",
            pendingValue
        );


        setMoney(
            "cancelledValue",
            cancelledValue
        );


        // Caso o HTML possua este campo
        setMoney(
            "registrationValue",
            VALOR_INSCRICAO
        );


        /* =====================================================
           PERCENTUAL RECEBIDO
           ===================================================== */

        const paidPercent =
            totalValue > 0
                ? (
                    paidValue /
                    totalValue
                ) * 100
                : 0;


        const percent =
            Math.min(
                100,
                Math.max(
                    0,
                    paidPercent
                )
            );


        setText(
            "paidPercent",
            `${percent.toFixed(0)}%`
        );


        /* =====================================================
           BARRA FINANCEIRA
           ===================================================== */

        const progress =
            document.getElementById(
                "paidProgress"
            );


        if (progress) {

            progress.style.width =
                `${percent}%`;

        }


        setText(
            "paidCount",
            paid
        );


        setText(
            "pendingCount",
            pending
        );


        setText(
            "cancelledCount",
            cancelled
        );


        /* =====================================================
           PERCURSOS
           ===================================================== */

        const km5 =
            rows.filter(row => {

                return (
                    upper(
                        row.percurso
                    ) === "5 KM"
                );

            }).length;


        const km10 =
            rows.filter(row => {

                return (
                    upper(
                        row.percurso
                    ) === "10 KM"
                );

            }).length;


        const routeTotal =
            km5 + km10;


        setText(
            "km5",
            km5
        );


        setText(
            "km10",
            km10
        );


        setText(
            "routeTotal",
            routeTotal
        );


        /* =====================================================
           GRÁFICO DE PERCURSOS
           ===================================================== */

        updateRouteChart(
            km5,
            km10
        );


        /* =====================================================
           GRÁFICO DE PAGAMENTOS
           ===================================================== */

        updatePaymentChart(
            paid,
            pending,
            cancelled,
            total
        );


        /* =====================================================
           CAMISETAS
           ===================================================== */

        const tamanhos =
            [
                "P",
                "M",
                "G",
                "GG"
            ];


        tamanhos.forEach(size => {

            const quantity =
                rows.filter(row => {

                    return (
                        upper(
                            row.camiseta
                        ) === size
                    );

                }).length;


            setText(
                "shirt" + size,
                quantity
            );

        });


        /* =====================================================
           RESUMO OPERACIONAL
           ===================================================== */

        setText(
            "operationTotal",
            total
        );


        setText(
            "operation5km",
            km5
        );


        setText(
            "operation10km",
            km10
        );


        setText(
            "operationPaid",
            paid
        );


        /* =====================================================
           FINALIZAR
           ===================================================== */

        hideMessage();


        console.log(
            "Dashboard carregado:",
            {
                total,
                paid,
                pending,
                cancelled,
                totalValue,
                paidValue,
                pendingValue,
                cancelledValue,
                km5,
                km10
            }
        );


    } catch (error) {

        console.error(
            "Erro no Dashboard:",
            error
        );


        showMessage(
            "Erro ao carregar dashboard: " +
            (
                error?.message ||
                "Erro desconhecido."
            )
        );

    }

}


/* =========================================================
   GRÁFICO DE PERCURSOS
   ========================================================= */

function updateRouteChart(
    km5,
    km10
) {

    const total =
        km5 + km10;


    const donut =
        document.querySelector(
            ".donut"
        );


    if (!donut) {
        return;
    }


    /* =====================================================
       SEM INSCRIÇÕES
       ===================================================== */

    if (total === 0) {

        donut.style.background =
            "conic-gradient(#e5e5e5 0deg 360deg)";

        return;
    }


    /* =====================================================
       PERCENTUAL 5 KM
       ===================================================== */

    const percent5 =
        (
            km5 /
            total
        ) * 100;


    const degrees5 =
        percent5 * 3.6;


    /* =====================================================
       ATUALIZAR DONUT
       ===================================================== */

    donut.style.background =
        `conic-gradient(
            var(--yellow) 0deg ${degrees5}deg,
            #292929 ${degrees5}deg 360deg
        )`;

}


/* =========================================================
   GRÁFICO DE PAGAMENTOS
   ========================================================= */

function updatePaymentChart(
    paid,
    pending,
    cancelled,
    total
) {

    const paidBar =
        document.getElementById(
            "paidBar"
        );


    const pendingBar =
        document.getElementById(
            "pendingBar"
        );


    const cancelledBar =
        document.getElementById(
            "cancelledBar"
        );


    /* =====================================================
       NENHUMA INSCRIÇÃO
       ===================================================== */

    if (!total) {

        if (paidBar) {

            paidBar.style.width =
                "0%";

        }


        if (pendingBar) {

            pendingBar.style.width =
                "0%";

        }


        if (cancelledBar) {

            cancelledBar.style.width =
                "0%";

        }


        setText(
            "cancelledChart",
            0
        );

        return;
    }


    /* =====================================================
       PAGOS
       ===================================================== */

    if (paidBar) {

        const percentage =
            (
                paid /
                total
            ) * 100;


        paidBar.style.width =
            `${percentage}%`;

    }


    /* =====================================================
       PENDENTES
       ===================================================== */

    if (pendingBar) {

        const percentage =
            (
                pending /
                total
            ) * 100;


        pendingBar.style.width =
            `${percentage}%`;

    }


    /* =====================================================
       CANCELADOS
       ===================================================== */

    if (cancelledBar) {

        const percentage =
            (
                cancelled /
                total
            ) * 100;


        cancelledBar.style.width =
            `${percentage}%`;

    }


    setText(
        "cancelledChart",
        cancelled
    );

}


/* =========================================================
   DEFINIR TEXTO
   ========================================================= */

function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (!element) {
        return;
    }


    element.textContent =
        value;

}


/* =========================================================
   FORMATAR DINHEIRO
   ========================================================= */

function setMoney(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (!element) {
        return;
    }


    const number =
        Number(value) || 0;


    element.textContent =
        number.toLocaleString(
            "pt-BR",
            {
                style: "currency",
                currency: "BRL"
            }
        );

}


/* =========================================================
   MOSTRAR MENSAGEM
   ========================================================= */

function showMessage(
    text
) {

    const element =
        document.getElementById(
            "dashboardMessage"
        );


    if (!element) {
        return;
    }


    element.textContent =
        text;


    element.classList.add(
        "show"
    );

}


/* =========================================================
   ESCONDER MENSAGEM
   ========================================================= */

function hideMessage() {

    const element =
        document.getElementById(
            "dashboardMessage"
        );


    if (!element) {
        return;
    }


    element.textContent =
        "";


    element.classList.remove(
        "show"
    );

}


/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        loadDashboard
    );

} else {

    loadDashboard();

}