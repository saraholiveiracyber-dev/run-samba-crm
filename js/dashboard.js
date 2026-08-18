const db = window.supabaseClient;


// ========================================
// DASHBOARD RUN & SAMBA
// ========================================

// VALOR OFICIAL DA INSCRIÇÃO
const VALOR_INSCRICAO = 89.90;


// ========================================
// CARREGAR DASHBOARD
// ========================================

async function loadDashboard() {

    try {

        // ========================================
        // AUTENTICAÇÃO
        // ========================================

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


        // ========================================
        // SUPABASE
        // ========================================

        if (!db) {

            showMessage(
                "Supabase não foi inicializado."
            );

            return;
        }


        // ========================================
        // BUSCAR INSCRIÇÕES
        // ========================================

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


        const rows = data || [];


        // ========================================
        // NORMALIZAR
        // ========================================

        const upper = value => {

            return String(
                value ?? ""
            )
                .trim()
                .toUpperCase();

        };


        // ========================================
        // CLASSIFICAÇÃO DOS PAGAMENTOS
        // ========================================

        const paidRows =
            rows.filter(row => {

                return (
                    upper(
                        row.status_pagamento
                    ) === "PAGO"
                );

            });


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


                // Cancelado nunca é pendente
                if (
                    pagamento === "CANCELADO" ||
                    status === "CANCELADO"
                ) {
                    return false;
                }


                // Pago nunca é pendente
                if (
                    pagamento === "PAGO"
                ) {
                    return false;
                }


                return (
                    pagamento === "" ||
                    pagamento === "PENDENTE"
                );

            });


        // ========================================
        // CONTADORES
        // ========================================

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


        // ========================================
        // FINANCEIRO
        // ========================================

        /*
            VALOR FIXO:

            Cada inscrição = R$ 89,90

            Cancelados não entram
            no valor previsto.
        */


        const validInscricoes =
            Math.max(
                total - cancelled,
                0
            );


        // Valor total previsto
        const totalValue =
            validInscricoes *
            VALOR_INSCRICAO;


        // Valor efetivamente recebido
        const paidValue =
            paid *
            VALOR_INSCRICAO;


        // Valor que ainda falta receber
        const pendingValue =
            pending *
            VALOR_INSCRICAO;


        // Valor referente aos cancelados
        const cancelledValue =
            cancelled *
            VALOR_INSCRICAO;


        // ========================================
        // MOSTRAR FINANCEIRO
        // ========================================

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


        // Caso exista no HTML
        setMoney(
            "registrationValue",
            VALOR_INSCRICAO
        );


        // ========================================
        // PERCENTUAL RECEBIDO
        // ========================================

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


        // ========================================
        // BARRA FINANCEIRA
        // ========================================

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


        // ========================================
        // PERCURSOS
        // ========================================

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
            km5 + km10
        );


        // ========================================
        // GRÁFICO DE PERCURSOS
        // ========================================

        updateRouteChart(
            km5,
            km10
        );


        // ========================================
        // GRÁFICO DE PAGAMENTOS
        // ========================================

        updatePaymentChart(
            paid,
            pending,
            cancelled,
            total
        );


        // ========================================
        // CAMISETAS
        // ========================================

        [
            "P",
            "M",
            "G",
            "GG"
        ].forEach(size => {

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


        // ========================================
        // RESUMO OPERACIONAL
        // ========================================

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


        // ========================================
        // FINALIZAR
        // ========================================

        hideMessage();


    } catch (error) {

        console.error(
            "Erro no Dashboard:",
            error
        );


        showMessage(
            "Erro ao carregar dashboard: " +
            error.message
        );

    }

}


// ========================================
// GRÁFICO DE PERCURSOS
// ========================================

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


    if (total === 0) {

        donut.style.background =
            "conic-gradient(#e5e5e5 0deg 360deg)";

        return;
    }


    const percent5 =
        (
            km5 /
            total
        ) * 100;


    const degrees5 =
        percent5 * 3.6;


    donut.style.background =
        `conic-gradient(
            var(--yellow) 0deg ${degrees5}deg,
            #292929 ${degrees5}deg 360deg
        )`;

}


// ========================================
// GRÁFICO DE PAGAMENTOS
// ========================================

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


    if (!total) {

        if (paidBar) {
            paidBar.style.width = "0%";
        }


        if (pendingBar) {
            pendingBar.style.width = "0%";
        }


        if (cancelledBar) {
            cancelledBar.style.width = "0%";
        }


        setText(
            "cancelledChart",
            0
        );

        return;
    }


    if (paidBar) {

        paidBar.style.width =
            `${(paid / total) * 100}%`;

    }


    if (pendingBar) {

        pendingBar.style.width =
            `${(pending / total) * 100}%`;

    }


    if (cancelledBar) {

        cancelledBar.style.width =
            `${(cancelled / total) * 100}%`;

    }


    setText(
        "cancelledChart",
        cancelled
    );

}


// ========================================
// TEXTO
// ========================================

function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.textContent =
            value;

    }

}


// ========================================
// DINHEIRO
// ========================================

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


    element.textContent =
        Number(
            value || 0
        ).toLocaleString(
            "pt-BR",
            {
                style: "currency",
                currency: "BRL"
            }
        );

}


// ========================================
// MENSAGEM
// ========================================

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


// ========================================
// ESCONDER MENSAGEM
// ========================================

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


// ========================================
// INICIAR
// ========================================

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