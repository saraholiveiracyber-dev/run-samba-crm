
"use strict";

/* =========================================================
   RUN & SAMBA CRM 2026
   DASHBOARD — INSCRIÇÕES, FINANCEIRO E OPERAÇÃO

   PAGAMENTOS:
   PAGO          = R$ 89,90
   PAGO_PARCEIRO = R$ 60,00
   PENDENTE      = valor cadastrado ou R$ 89,90
   CANCELADO     = não entra no recebido
   CORTESIA      = não entra no recebido

   PARTICIPANTES CONFIRMADOS:
   PAGO + PAGO_PARCEIRO
========================================================= */


/* =========================================================
   1. CONFIGURAÇÕES
========================================================= */

const VALOR_INSCRICAO = 89.90;
const VALOR_PARCEIRO = 60.00;
const META_PARTICIPANTES = 150;

const CENTAVOS_INSCRICAO = 8990;
const CENTAVOS_PARCEIRO = 6000;

const MOEDA = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
});

const NUMERO = new Intl.NumberFormat("pt-BR");


/* =========================================================
   2. FUNÇÕES GERAIS
========================================================= */

function getElement(id) {
    return document.getElementById(id);
}

function setText(id, value) {
    const element = getElement(id);

    if (element) {
        element.textContent = value;
    }
}

function setMoney(id, valueInCents) {
    const element = getElement(id);

    if (element) {
        element.textContent = MOEDA.format(
            (Number(valueInCents) || 0) / 100
        );
    }
}

function setPercent(id, percent) {
    const element = getElement(id);

    if (!element) return;

    const valor = Number(percent) || 0;

    element.textContent = `${valor.toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    })}%`;
}

function setBarWidth(id, percent) {
    const element = getElement(id);

    if (!element) return;

    const safePercent = Math.max(
        0,
        Math.min(100, Number(percent) || 0)
    );

    element.style.width = `${safePercent}%`;
}

function normalizeStatus(value) {
    return String(value ?? "")
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ");
}


/* =========================================================
   3. CONVERSÃO DE VALORES PARA CENTAVOS
========================================================= */

function parseMoneyToCents(value) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    if (typeof value === "number") {
        return Number.isFinite(value)
            ? Math.round(value * 100)
            : null;
    }

    let text = String(value)
        .trim()
        .replace(/R\$/gi, "")
        .replace(/\s/g, "");

    if (!text) return null;

    // Formato brasileiro: 1.234,56
    if (text.includes(",")) {
        text = text
            .replace(/\./g, "")
            .replace(",", ".");
    }

    const parsed = Number(text);

    if (!Number.isFinite(parsed)) {
        return null;
    }

    return Math.round(parsed * 100);
}


/* =========================================================
   4. CLASSIFICAÇÃO DOS PAGAMENTOS
========================================================= */

function classifyRegistration(row) {
    const payment = normalizeStatus(row.status_pagamento);
    const status = normalizeStatus(row.status);

    /*
     * IMPORTANTE:
     * PAGO_PARCEIRO precisa ser identificado primeiro.
     * Assim, nunca será confundido com PAGO.
     */

    if (payment === "PAGO_PARCEIRO") {
        return "PAGO_PARCEIRO";
    }

    if (payment === "PAGO") {
        return "PAGO";
    }

    if (
        payment === "CANCELADO" ||
        payment === "CANCELADA"
    ) {
        return "CANCELADO";
    }

    if (payment === "CORTESIA") {
        return "CORTESIA";
    }

    if (
        payment === "PENDENTE" ||
        payment === "PENDENCIA"
    ) {
        return "PENDENTE";
    }

    /*
     * Compatibilidade com registros antigos
     * que possam utilizar a coluna status.
     */

    if (
        status === "CANCELADO" ||
        status === "CANCELADA" ||
        status === "CANCELLED" ||
        status === "CANCELED"
    ) {
        return "CANCELADO";
    }

    if (
        status === "CORTESIA" ||
        status === "CORTESIA CONFIRMADA"
    ) {
        return "CORTESIA";
    }

    if (
        [
            "PAGO",
            "PAGA",
            "PAGAMENTO CONFIRMADO",
            "PAGAMENTO APROVADO",
            "CONFIRMADO",
            "CONFIRMADA",
            "APROVADO",
            "APROVADA",
            "RECEBIDO",
            "RECEBIDA",
            "PAID",
            "COMPLETED"
        ].includes(status)
    ) {
        return "PAGO";
    }

    if (
        payment === "" ||
        [
            "",
            "PENDENTE",
            "PENDENCIA",
            "AGUARDANDO",
            "AGUARDANDO PAGAMENTO",
            "EM ABERTO",
            "NAO PAGO",
            "PROCESSANDO",
            "PROCESSING",
            "WAITING"
        ].includes(status)
    ) {
        return "PENDENTE";
    }

    return "OUTRO";
}


/* =========================================================
   5. VALORES FINANCEIROS POR CATEGORIA
========================================================= */

function getRegistrationValueCents(item) {
    const category = item.category;
    const row = item.row;

    // Pagamento normal: R$ 89,90.
    if (category === "PAGO") {
        return CENTAVOS_INSCRICAO;
    }

    // Pagamento parceiro: R$ 60,00.
    if (category === "PAGO_PARCEIRO") {
        return CENTAVOS_PARCEIRO;
    }

    /*
     * Para pendentes, utiliza o valor registrado.
     * Se não houver valor, utiliza R$ 89,90.
     */

    const value = parseMoneyToCents(row?.valor);

    if (value === null || value < 0) {
        return CENTAVOS_INSCRICAO;
    }

    return value;
}

function sumRegistrationValuesCents(items) {
    return items.reduce((total, item) => {
        return total + getRegistrationValueCents(item);
    }, 0);
}


/* =========================================================
   6. PERCURSOS
========================================================= */

function normalizeRoute(value) {
    return normalizeStatus(value)
        .replace(/\s+/g, "");
}

function getRoute(row) {
    const route = normalizeRoute(row.percurso);

    if (
        route === "5" ||
        route === "5K" ||
        route === "5KM" ||
        route.includes("5QUILOMET")
    ) {
        return "5KM";
    }

    if (
        route === "10" ||
        route === "10K" ||
        route === "10KM" ||
        route.includes("10QUILOMET")
    ) {
        return "10KM";
    }

    return "OUTRO";
}


/* =========================================================
   7. TAMANHOS DAS CAMISETAS
========================================================= */

function normalizeShirtSize(value) {
    const size = normalizeStatus(value)
        .replace(/\s/g, "")
        .replace(/CAMISETA/g, "")
        .replace(/CAMISA/g, "");

    if (["P", "PP", "XPP"].includes(size)) return "P";
    if (["M", "XM"].includes(size)) return "M";
    if (["G", "L"].includes(size)) return "G";
    if (["GG", "XG", "XL", "XGG"].includes(size)) return "GG";

    return "OUTRO";
}


/* =========================================================
   8. GRÁFICO DE PAGAMENTOS
========================================================= */

function updatePaymentBars(
    paid,
    partnerPaid,
    pending,
    cancelled
) {
    const total =
        paid +
        partnerPaid +
        pending +
        cancelled;

    const paidPercent = total > 0
        ? (paid / total) * 100
        : 0;

    const partnerPercent = total > 0
        ? (partnerPaid / total) * 100
        : 0;

    const pendingPercent = total > 0
        ? (pending / total) * 100
        : 0;

    const cancelledPercent = total > 0
        ? (cancelled / total) * 100
        : 0;

    setBarWidth("paidBar", paidPercent);
    setBarWidth("partnerPaidBar", partnerPercent);
    setBarWidth("pendingBar", pendingPercent);
    setBarWidth("cancelledBar", cancelledPercent);
}


/* =========================================================
   9. GRÁFICO DE PERCURSOS
========================================================= */

function updateRouteChart(km5, km10) {
    const total = km5 + km10;

    setText("km5", NUMERO.format(km5));
    setText("km10", NUMERO.format(km10));
    setText("routeTotal", NUMERO.format(total));

    const donut = document.querySelector(".donut");

    if (!donut) return;

    const km5Percent = total > 0
        ? (km5 / total) * 100
        : 0;

    donut.style.background = total > 0
        ? `conic-gradient(
            var(--amarelo, #f5c400) 0% ${km5Percent}%,
            var(--black-2, #252525) ${km5Percent}% 100%
        )`
        : "var(--black-2, #252525)";
}


/* =========================================================
   10. META DE PARTICIPANTES
========================================================= */

function updateParticipantGoal(confirmed) {
    const remaining = Math.max(
        0,
        META_PARTICIPANTES - confirmed
    );

    const percentage =
        (confirmed / META_PARTICIPANTES) * 100;

    setText(
        "goalParticipants",
        NUMERO.format(confirmed)
    );

    setText(
        "goalTargetParticipants",
        NUMERO.format(META_PARTICIPANTES)
    );

    setText(
        "goalPercent",
        `${percentage.toLocaleString("pt-BR", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        })}% da meta alcançada`
    );

    setText(
        "goalRemaining",
        remaining > 0
            ? `Faltam ${NUMERO.format(remaining)} participantes`
            : `Meta atingida! ${NUMERO.format(
                confirmed - META_PARTICIPANTES
            )} acima do objetivo`
    );

    setBarWidth("goalProgressBar", percentage);
}


/* =========================================================
   11. CARREGAMENTO DO DASHBOARD
========================================================= */

async function loadDashboard() {
    const db = window.supabaseClient;

    if (!db) {
        console.error(
            "Supabase não encontrado. Confira js/config.js."
        );

        alert(
            "Não foi possível conectar ao Supabase. " +
            "Verifique a configuração do CRM."
        );

        return;
    }

    try {
        const { data, error } = await db
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
            .order("created_at", { ascending: false });

        if (error) throw error;

        const rows = Array.isArray(data) ? data : [];

        /*
         * Cada inscrição é classificada uma única vez.
         */

        const classified = rows.map(row => ({
            row,
            category: classifyRegistration(row)
        }));


        /* =================================================
           11.1 CONTAGENS
        ================================================= */

        const paidRows = classified.filter(
            item => item.category === "PAGO"
        );

        const partnerPaidRows = classified.filter(
            item => item.category === "PAGO_PARCEIRO"
        );

        const pendingRows = classified.filter(
            item => item.category === "PENDENTE"
        );

        const cancelledRows = classified.filter(
            item => item.category === "CANCELADO"
        );

        const courtesyRows = classified.filter(
            item => item.category === "CORTESIA"
        );

        const otherRows = classified.filter(
            item => item.category === "OUTRO"
        );

        const total = rows.length;

        const paid = paidRows.length;
        const partnerPaid = partnerPaidRows.length;
        const pending = pendingRows.length;
        const cancelled = cancelledRows.length;
        const courtesies = courtesyRows.length;
        const other = otherRows.length;

        // Total de participantes com pagamento confirmado.
        const participantesConfirmados =
            paid + partnerPaid;


        /* =================================================
           11.2 FINANCEIRO
        ================================================= */

        const paidValueCents =
            sumRegistrationValuesCents(paidRows);

        const partnerPaidValueCents =
            sumRegistrationValuesCents(partnerPaidRows);

        const pendingValueCents =
            sumRegistrationValuesCents(pendingRows);

        const cancelledValueCents =
            sumRegistrationValuesCents(cancelledRows);

        const courtesyValueCents =
            sumRegistrationValuesCents(courtesyRows);

        // Recebido: pagos normais + parceiros.
        const receivedValueCents =
            paidValueCents + partnerPaidValueCents;

        // Total financeiro válido: recebido + pendente.
        const totalValueCents =
            receivedValueCents + pendingValueCents;


        /* =================================================
           11.3 CARDS SUPERIORES
        ================================================= */

        setText("total", NUMERO.format(total));

        setText(
            "courtesies",
            NUMERO.format(courtesies)
        );

        setText(
            "cancelled",
            NUMERO.format(cancelled)
        );

        // Recebido total.
        setMoney("paidValue", receivedValueCents);

        // Valor pendente.
        setMoney("pendingValue", pendingValueCents);

        // Total de inscrições válidas.
        setMoney("totalValue", totalValueCents);

        // Parceiros.
        setText(
            "partnerPaid",
            NUMERO.format(partnerPaid)
        );

        setMoney(
            "partnerPaidValue",
            partnerPaidValueCents
        );


        /* =================================================
           11.4 META DE PARTICIPANTES
        ================================================= */

        updateParticipantGoal(participantesConfirmados);


        /* =================================================
           11.5 RECEBIMENTOS
        ================================================= */

        setText(
            "paidCount",
            NUMERO.format(paid)
        );

        setText(
            "partnerPaidCount",
            NUMERO.format(partnerPaid)
        );

        setText(
            "pendingCount",
            NUMERO.format(pending)
        );

        const totalPagamentos =
            paid +
            partnerPaid +
            pending +
            cancelled;

        const paidPercent = totalPagamentos > 0
            ? (participantesConfirmados / totalPagamentos) * 100
            : 0;

        setPercent("paidPercent", paidPercent);
        setBarWidth("paidProgress", paidPercent);


        /* =================================================
           11.6 GRÁFICO DE PAGAMENTOS
        ================================================= */

        setText(
            "paid",
            NUMERO.format(paid)
        );

        setText(
            "partnerPaidChart",
            NUMERO.format(partnerPaid)
        );

        setText(
            "pending",
            NUMERO.format(pending)
        );

        setText(
            "cancelledChart",
            NUMERO.format(cancelled)
        );

        updatePaymentBars(
            paid,
            partnerPaid,
            pending,
            cancelled
        );


        /* =================================================
           11.7 PERCURSOS
        ================================================= */

        // Cancelados não entram na distribuição dos atletas.
        const operationalRows = classified.filter(
            item => item.category !== "CANCELADO"
        );

        let km5 = 0;
        let km10 = 0;

        operationalRows.forEach(item => {
            const route = getRoute(item.row);

            if (route === "5KM") km5++;
            if (route === "10KM") km10++;
        });

        updateRouteChart(km5, km10);


        /* =================================================
           11.8 CAMISETAS
           PAGOS + PAGO PARCEIRO
        ================================================= */

        const shirtCounts = {
            P: 0,
            M: 0,
            G: 0,
            GG: 0
        };

        const confirmedRows = [
            ...paidRows,
            ...partnerPaidRows
        ];

        confirmedRows.forEach(item => {
            const size = normalizeShirtSize(
                item.row.camiseta
            );

            if (
                Object.prototype.hasOwnProperty.call(
                    shirtCounts,
                    size
                )
            ) {
                shirtCounts[size]++;
            }
        });

        setText(
            "shirtP",
            NUMERO.format(shirtCounts.P)
        );

        setText(
            "shirtM",
            NUMERO.format(shirtCounts.M)
        );

        setText(
            "shirtG",
            NUMERO.format(shirtCounts.G)
        );

        setText(
            "shirtGG",
            NUMERO.format(shirtCounts.GG)
        );

        const totalCamisetasPagas =
            shirtCounts.P +
            shirtCounts.M +
            shirtCounts.G +
            shirtCounts.GG;

        // Atualiza somente se o elemento existir no HTML.
        setText(
            "shirtTotal",
            NUMERO.format(totalCamisetasPagas)
        );


        /* =================================================
           11.9 RESUMO DA OPERAÇÃO
        ================================================= */

        setText(
            "operationTotal",
            NUMERO.format(total)
        );

        setText(
            "operation5km",
            NUMERO.format(km5)
        );

        setText(
            "operation10km",
            NUMERO.format(km10)
        );

        // Pagos normais + parceiros.
        setText(
            "operationPaid",
            NUMERO.format(participantesConfirmados)
        );


        /* =================================================
           11.10 CONFERÊNCIA FINANCEIRA
        ================================================= */

        console.group("RUN & SAMBA — DASHBOARD 2026");

        console.table({
            "Pagamentos normais": paid,
            "Valor dos pagamentos normais":
                MOEDA.format(paidValueCents / 100),

            "Pagamentos parceiros": partnerPaid,
            "Valor dos pagamentos parceiros":
                MOEDA.format(partnerPaidValueCents / 100),

            "Total de pagamentos confirmados":
                participantesConfirmados,

            "Recebido total":
                MOEDA.format(receivedValueCents / 100),

            "Pendentes": pending,
            "A receber":
                MOEDA.format(pendingValueCents / 100),

            "Cortesias": courtesies,
            "Cancelados": cancelled,

            "Total financeiro válido":
                MOEDA.format(totalValueCents / 100)
        });

        console.table({
            "Meta de participantes": META_PARTICIPANTES,
            "Participantes confirmados": participantesConfirmados,
            "Participantes restantes": Math.max(
                0,
                META_PARTICIPANTES - participantesConfirmados
            ),
            "Percentual da meta":
                `${(
                    participantesConfirmados /
                    META_PARTICIPANTES *
                    100
                ).toFixed(1)}%`
        });

        console.table({
            "Camisetas P": shirtCounts.P,
            "Camisetas M": shirtCounts.M,
            "Camisetas G": shirtCounts.G,
            "Camisetas GG": shirtCounts.GG,
            "Total de camisetas": totalCamisetasPagas
        });

        if (other > 0) {
            console.warn(
                `${other} inscrição(ões) possuem status não reconhecido.`,
                otherRows.map(item => ({
                    id: item.row.id,
                    status: item.row.status,
                    status_pagamento: item.row.status_pagamento
                }))
            );
        }

        console.groupEnd();

    } catch (error) {
        console.error(
            "Erro ao carregar o dashboard:",
            error
        );

        alert(
            "Erro ao carregar o dashboard: " +
            (error?.message || "Erro desconhecido.") +
            "\n\nVerifique a conexão e as permissões do Supabase."
        );
    }
}


/* =========================================================
   12. SAIR DO SISTEMA
========================================================= */

function setupLogout() {
    const logoutBtn = getElement("logoutBtn");

    if (!logoutBtn) return;

    logoutBtn.addEventListener("click", async () => {
        logoutBtn.disabled = true;
        logoutBtn.textContent = "SAINDO...";

        try {
            const db = window.supabaseClient;

            if (window.crmAuth?.logout) {
                await window.crmAuth.logout();
            } else if (db?.auth) {
                const { error } = await db.auth.signOut();

                if (error) throw error;
            }

            window.location.href = "login.html";

        } catch (error) {
            console.error("Erro ao sair:", error);

            logoutBtn.disabled = false;
            logoutBtn.textContent = "SAIR";

            alert(
                "Não foi possível encerrar a sessão. Tente novamente."
            );
        }
    });
}


/* =========================================================
   13. INICIALIZAÇÃO
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
    setupLogout();

    try {
        if (
            window.crmAuth &&
            typeof window.crmAuth.requireAuth === "function"
        ) {
            const result = await window.crmAuth.requireAuth();

            if (!result) return;
        }

        await loadDashboard();

    } catch (error) {
        console.error(
            "Erro ao iniciar o dashboard:",
            error
        );
    }
});
