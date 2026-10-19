
"use strict";

/* =========================================================
   RUN & SAMBA CRM 2026
   DASHBOARD — INSCRIÇÕES, FINANCEIRO E OPERAÇÃO
========================================================= */

const VALOR_INSCRICAO = 89.90;
const META_FINANCEIRA = 50000.00;

const MOEDA = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
});

const NUMERO = new Intl.NumberFormat("pt-BR");


/* =========================================================
   1. FUNÇÕES GERAIS
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
        element.textContent = MOEDA.format(valueInCents / 100);
    }
}

function setPercent(id, percent) {
    const element = getElement(id);

    if (element) {
        element.textContent = `${percent.toLocaleString("pt-BR", {
            maximumFractionDigits: 1
        })}%`;
    }
}

function setBarWidth(id, percent) {
    const element = getElement(id);

    if (element) {
        const safePercent = Math.max(0, Math.min(100, percent));
        element.style.width = `${safePercent}%`;
    }
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
   2. CONVERSÃO DE VALORES PARA CENTAVOS
========================================================= */

function parseMoneyToCents(value) {
    if (typeof value === "number") {
        return Number.isFinite(value)
            ? Math.round(value * 100)
            : null;
    }

    if (value === null || value === undefined || value === "") {
        return null;
    }

    let text = String(value)
        .trim()
        .replace(/R\$/gi, "")
        .replace(/\s/g, "");

    if (!text) {
        return null;
    }

    // Formato brasileiro: 1.234,56
    if (text.includes(",")) {
        text = text
            .replace(/\./g, "")
            .replace(",", ".");
    }

    // Formato decimal com ponto: 1234.56
    const parsed = Number(text);

    if (!Number.isFinite(parsed)) {
        return null;
    }

    return Math.round(parsed * 100);
}

function getRegistrationValueCents(row) {
    const value = parseMoneyToCents(row?.valor);

    // Se não houver valor cadastrado, utiliza o valor padrão.
    if (value === null || value < 0) {
        return Math.round(VALOR_INSCRICAO * 100);
    }

    return value;
}

function sumRegistrationValuesCents(items) {
    return items.reduce((total, item) => {
        return total + getRegistrationValueCents(item.row);
    }, 0);
}


/* =========================================================
   3. CLASSIFICAÇÃO DOS PAGAMENTOS
========================================================= */

function classifyRegistration(row) {
    const payment = normalizeStatus(row.status_pagamento);
    const status = normalizeStatus(row.status);

    const statuses = [payment, status];

    // Cancelados não entram no financeiro válido.
    if (statuses.some(value =>
        ["CANCELADO", "CANCELADA", "CANCELLED", "CANCELED"].includes(value)
    )) {
        return "CANCELADO";
    }

    // Cortesias não são receita financeira.
    if (statuses.some(value =>
        ["CORTESIA", "CORTESIA CONFIRMADA"].includes(value)
    )) {
        return "CORTESIA";
    }

    // Pagamentos confirmados.
    if (statuses.some(value =>
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
        ].includes(value)
    )) {
        return "PAGO";
    }

    // Pagamentos pendentes ou ainda não identificados.
    if (
        payment === "" ||
        statuses.some(value =>
            [
                "",
                "PENDENTE",
                "PENDENCIA",
                "AGUARDANDO",
                "AGUARDANDO PAGAMENTO",
                "EM ABERTO",
                "NAO PAGO",
                "NÃO PAGO",
                "PROCESSANDO",
                "PROCESSING",
                "WAITING"
            ].includes(value)
        )
    ) {
        return "PENDENTE";
    }

    return "OUTRO";
}


/* =========================================================
   4. PERCURSOS
========================================================= */

function normalizeRoute(value) {
    return normalizeStatus(value)
        .replace(/\s+/g, "")
        .replace(/KM/g, "KM");
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
   5. TAMANHOS DAS CAMISETAS
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
   6. GRÁFICOS E BARRAS
========================================================= */

function updatePaymentBars(paid, pending, cancelled) {
    const total = paid + pending + cancelled;

    const paidPercent = total > 0 ? (paid / total) * 100 : 0;
    const pendingPercent = total > 0 ? (pending / total) * 100 : 0;
    const cancelledPercent = total > 0
        ? (cancelled / total) * 100
        : 0;

    setBarWidth("paidBar", paidPercent);
    setBarWidth("pendingBar", pendingPercent);
    setBarWidth("cancelledBar", cancelledPercent);
}

function updateRouteChart(km5, km10) {
    const total = km5 + km10;

    setText("km5", NUMERO.format(km5));
    setText("km10", NUMERO.format(km10));
    setText("routeTotal", NUMERO.format(total));

    const donut = document.querySelector(".donut");

    if (donut) {
        const km5Percent = total > 0 ? (km5 / total) * 100 : 0;

        donut.style.background = total > 0
            ? `conic-gradient(
                var(--amarelo, #f5c400) 0% ${km5Percent}%,
                var(--black-2, #252525) ${km5Percent}% 100%
            )`
            : "var(--black-2, #252525)";
    }
}


/* =========================================================
   7. CARREGAMENTO DO DASHBOARD
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

    // Consulta inscrições.
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

    if (error) {
        console.error("Erro ao carregar inscrições:", error);

        alert(
            "Erro ao carregar o dashboard. " +
            "Confira as permissões da tabela inscricoes no Supabase."
        );

        return;
    }

    const rows = Array.isArray(data) ? data : [];

    // Classifica cada inscrição uma única vez.
    const classified = rows.map(row => ({
        row,
        category: classifyRegistration(row)
    }));


    /* -----------------------------------------------------
       CONTAGENS
    ----------------------------------------------------- */

    const paidRows = classified.filter(
        item => item.category === "PAGO"
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
    const pending = pendingRows.length;
    const cancelled = cancelledRows.length;
    const courtesies = courtesyRows.length;
    const other = otherRows.length;


    /* -----------------------------------------------------
       VALORES FINANCEIROS
    ----------------------------------------------------- */

    // Todos os valores são somados em centavos para evitar
    // erros de arredondamento em operações com dinheiro.

    const paidValueCents = sumRegistrationValuesCents(paidRows);

    const pendingValueCents = sumRegistrationValuesCents(pendingRows);

    const cancelledValueCents = sumRegistrationValuesCents(cancelledRows);

    const courtesyValueCents = sumRegistrationValuesCents(courtesyRows);

    // Total financeiro válido: somente pagos + pendentes.
    const totalValueCents = paidValueCents + pendingValueCents;

    const goalCents = Math.round(META_FINANCEIRA * 100);

    const remainingCents = Math.max(
        0,
        goalCents - paidValueCents
    );

    const goalPercent = goalCents > 0
        ? (paidValueCents / goalCents) * 100
        : 0;

    // Percentual de pagamentos confirmados entre pagos e pendentes.
    const paymentBase = paid + pending;

    const paidPercent = paymentBase > 0
        ? (paid / paymentBase) * 100
        : 0;


    /* -----------------------------------------------------
       CARDS SUPERIORES
    ----------------------------------------------------- */

    setText("total", NUMERO.format(total));
    setText("courtesies", NUMERO.format(courtesies));
    setText("cancelled", NUMERO.format(cancelled));

    setMoney("paidValue", paidValueCents);
    setMoney("pendingValue", pendingValueCents);
    setMoney("totalValue", totalValueCents);


    /* -----------------------------------------------------
       META FINANCEIRA
    ----------------------------------------------------- */

    setMoney("goalReceived", paidValueCents);
    setMoney("goalTarget", goalCents);
    setMoney("goalRemaining", remainingCents);

    setPercent("goalPercent", goalPercent);
    setBarWidth("goalProgressBar", goalPercent);


    /* -----------------------------------------------------
       RECEBIMENTO DAS INSCRIÇÕES
    ----------------------------------------------------- */

    setText("paidCount", NUMERO.format(paid));
    setText("pendingCount", NUMERO.format(pending));

    setPercent("paidPercent", paidPercent);
    setBarWidth("paidProgress", paidPercent);


    /* -----------------------------------------------------
       GRÁFICO DE STATUS DOS PAGAMENTOS
    ----------------------------------------------------- */

    setText("paid", NUMERO.format(paid));
    setText("pending", NUMERO.format(pending));
    setText("cancelledChart", NUMERO.format(cancelled));

    updatePaymentBars(paid, pending, cancelled);


    /* -----------------------------------------------------
       PERCURSOS
    ----------------------------------------------------- */

    // Inscrições canceladas não contam como participantes ativos.
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


    /* -----------------------------------------------------
       CAMISETAS
    ----------------------------------------------------- */

    const shirtCounts = {
        P: 0,
        M: 0,
        G: 0,
        GG: 0
    };

    operationalRows.forEach(item => {
        const size = normalizeShirtSize(item.row.camiseta);

        if (Object.prototype.hasOwnProperty.call(shirtCounts, size)) {
            shirtCounts[size]++;
        }
    });

    setText("shirtP", NUMERO.format(shirtCounts.P));
    setText("shirtM", NUMERO.format(shirtCounts.M));
    setText("shirtG", NUMERO.format(shirtCounts.G));
    setText("shirtGG", NUMERO.format(shirtCounts.GG));


    /* -----------------------------------------------------
       RESUMO DA OPERAÇÃO
    ----------------------------------------------------- */

    setText("operationTotal", NUMERO.format(total));
    setText("operation5km", NUMERO.format(km5));
    setText("operation10km", NUMERO.format(km10));
    setText("operationPaid", NUMERO.format(paid));


    /* -----------------------------------------------------
       RESUMO NO CONSOLE
    ----------------------------------------------------- */

    console.group("RUN & SAMBA CRM — Dashboard");

    console.table({
        "Total de inscrições": total,
        "Pagamentos confirmados": paid,
        "Pagamentos pendentes": pending,
        "Cortesias": courtesies,
        "Cancelados": cancelled,
        "Outros status": other
    });

    console.table({
        "Recebido": MOEDA.format(paidValueCents / 100),
        "A receber": MOEDA.format(pendingValueCents / 100),
        "Cortesias (referência)": MOEDA.format(courtesyValueCents / 100),
        "Cancelados (referência)": MOEDA.format(cancelledValueCents / 100),
        "Total financeiro válido": MOEDA.format(totalValueCents / 100),
        "Meta": MOEDA.format(goalCents / 100),
        "Falta para a meta": MOEDA.format(remainingCents / 100),
        "Percentual da meta": `${goalPercent.toFixed(2)}%`
    });

    if (other > 0) {
        console.warn(
            `${other} inscrição(ões) possuem status não reconhecido. ` +
            "Confira os campos status e status_pagamento no Supabase.",
            otherRows.map(item => ({
                id: item.row.id,
                status: item.row.status,
                status_pagamento: item.row.status_pagamento
            }))
        );
    }

    console.groupEnd();
}


/* =========================================================
   8. SAIR DO SISTEMA
========================================================= */

function setupLogout() {
    const logoutBtn = getElement("logoutBtn");

    if (!logoutBtn) return;

    logoutBtn.addEventListener("click", async () => {
        logoutBtn.disabled = true;
        logoutBtn.textContent = "SAINDO...";

        try {
            const db = window.supabaseClient;

            if (db?.auth) {
                const { error } = await db.auth.signOut();

                if (error) {
                    throw error;
                }
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
   9. INICIALIZAÇÃO
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
    setupLogout();

    try {
        // Mantém a verificação de autenticação existente no projeto.
        if (
            window.crmAuth &&
            typeof window.crmAuth.requireAuth === "function"
        ) {
            const result = await window.crmAuth.requireAuth();

            if (result === false) return;
        }

        await loadDashboard();
    } catch (error) {
        console.error("Erro ao iniciar o dashboard:", error);
    }
});
