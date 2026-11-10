"use strict";

/* =========================================================
   RUN & SAMBA 2026 — CRM INSCRITOS
   Administração • Supabase • IzyPass • Comunicação • F9

   STATUS:
   PAGO
   PAGO_PARCEIRO — R$ 60,00
   PENDENTE
   CANCELADO
   CORTESIA

   F9:
   MENSAGEM_ENVIADA
   RESPONDEU
   NAO_RESPONDIDO
   NOVO

   IZYPASS:
   Valor de referência: R$ 89,90
   Total local = quantidade x R$ 89,90
========================================================= */

/* =========================================================
   ESTADO
========================================================= */

let db = null;
let allRows = [];
let selectedId = null;
let loadingRows = false;
let eventsBound = false;

const IZY_PRICE = 89.90;
const PARTNER_PRICE = 60.00;

const IZY_STORAGE_KEY = "run_samba_izy_paid_count_v1";

const $ = id => document.getElementById(id);

/* =========================================================
   INICIALIZAÇÃO
========================================================= */

async function init() {
    const guard = $("adminGuard");
    const app = $("adminApp");

    if (guard) guard.hidden = false;
    if (app) app.hidden = true;

    if ($("guardTitle")) {
        $("guardTitle").textContent = "Área restrita";
    }

    if ($("guardMessage")) {
        $("guardMessage").textContent =
            "Verificando autorização de acesso...";
    }

    if ($("guardStatus")) {
        $("guardStatus").textContent = "Aguarde...";
    }

    if ($("guardError")) {
        $("guardError").hidden = true;
        $("guardError").textContent = "";
    }

    try {
        db = window.supabaseClient;

        if (!db) {
            accessError(
                "Supabase não foi inicializado. Verifique js/config.js."
            );
            return;
        }

        if (
            !window.crmAuth ||
            typeof window.crmAuth.requireAuth !== "function"
        ) {
            accessError("Sistema de autenticação não encontrado.");
            return;
        }

        const session = await window.crmAuth.requireAuth();

        if (!session) return;

        const { data: userData, error: userError } =
            await db.auth.getUser();

        if (userError || !userData?.user) {
            accessError(
                "Não foi possível confirmar sua sessão. Entre novamente."
            );
            return;
        }

        const { data: admin, error: adminError } = await db
            .from("admin_users")
            .select("user_id")
            .eq("user_id", userData.user.id)
            .maybeSingle();

        if (adminError) {
            console.error(
                "Erro ao verificar administrador:",
                adminError
            );

            accessError(
                "Não foi possível validar sua autorização administrativa. " +
                "Verifique as permissões da tabela admin_users."
            );
            return;
        }

        if (!admin) {
            accessError(
                "Seu usuário não possui autorização para acessar os inscritos."
            );
            return;
        }

        if (guard) guard.hidden = true;
        if (app) app.hidden = false;

        bindEvents();
        initIzySummary();

        await loadRows();

    } catch (error) {
        console.error("Erro ao iniciar CRM:", error);

        accessError(
            "Não foi possível iniciar o sistema. " +
            (error?.message || "Erro desconhecido.")
        );
    }
}

/* =========================================================
   CONTROLE DE ACESSO
========================================================= */

function accessError(message) {
    if ($("adminApp")) $("adminApp").hidden = true;
    if ($("adminGuard")) $("adminGuard").hidden = false;

    if ($("guardTitle")) {
        $("guardTitle").textContent = "Acesso restrito";
    }

    if ($("guardMessage")) {
        $("guardMessage").textContent = message;
    }

    if ($("guardStatus")) {
        $("guardStatus").textContent = "ACESSO NÃO AUTORIZADO";
    }

    if ($("guardError")) {
        $("guardError").textContent = message;
        $("guardError").hidden = false;
    }

    const logout = $("guardLogout");

    if (logout) {
        logout.hidden = false;

        logout.onclick = async () => {
            logout.disabled = true;
            logout.textContent = "SAINDO...";

            try {
                if (window.crmAuth?.logout) {
                    await window.crmAuth.logout();
                } else if (db) {
                    await db.auth.signOut();
                }
            } catch (error) {
                console.error("Erro ao encerrar sessão:", error);
            } finally {
                window.location.replace("index.html");
            }
        };
    }
}

/* =========================================================
   EVENTOS
========================================================= */

function bindEvents() {
    if (eventsBound) return;

    eventsBound = true;

    const tableBody = $("tableBody");

    if (tableBody) {
        tableBody.addEventListener("click", event => {
            const target = event.target instanceof Element
                ? event.target
                : null;

            const button = target?.closest(
                ".participant-name-button, .action-btn"
            );

            if (!button || !tableBody.contains(button)) return;

            event.preventDefault();

            const id = button.dataset.id;

            if (!id) {
                showMessage("ID do participante não encontrado.");
                return;
            }

            openModal(id);
        });
    }

    ["search", "paymentFilter", "routeFilter", "shirtFilter"]
        .forEach(id => {
            const element = $(id);

            if (!element) return;

            element.addEventListener("input", render);
            element.addEventListener("change", render);
        });

    $("exportBtn")?.addEventListener("click", exportCSV);

    $("closeModal")?.addEventListener("click", closeModal);

    $("savePayment")?.addEventListener("click", savePayment);

    $("saveContactFollowup")?.addEventListener(
        "click",
        saveContactFollowup
    );

    $("editModal")?.addEventListener("click", event => {
        const modal = $("editModal");

        if (
            event.target === modal ||
            event.target.classList.contains("modal-overlay")
        ) {
            closeModal();
        }
    });

    $("logoutBtn")?.addEventListener("click", logout);

    document.addEventListener("keydown", event => {
        const modal = $("editModal");

        if (!modal || modal.classList.contains("hidden")) return;

        if (event.key === "Escape") {
            closeModal();
        }

        if (event.key === "F9") {
            event.preventDefault();
            $("contactStatus")?.focus();
        }
    });
}

/* =========================================================
   SAIR
========================================================= */

async function logout() {
    const button = $("logoutBtn");

    if (button) {
        button.disabled = true;
        button.textContent = "SAINDO...";
    }

    try {
        if (window.crmAuth?.logout) {
            await window.crmAuth.logout();
        } else if (db) {
            await db.auth.signOut();
        }

        window.location.replace("index.html");

    } catch (error) {
        console.error("Erro ao sair:", error);

        if (button) {
            button.disabled = false;
            button.textContent = "SAIR";
        }

        showMessage("Não foi possível sair. Tente novamente.");
    }
}

/* =========================================================
   IZYPASS — RESUMO LOCAL
========================================================= */

function initIzySummary() {
    const input = $("izyPaidCount");
    const total = $("izyTotalReceived");
    const saveButton = $("saveIzyPaidCount");
    const message = $("izySalesMessage");

    if (!input || !total) return;

    input.min = "0";
    input.step = "1";
    input.inputMode = "numeric";

    let savedCount = 0;

    try {
        const stored = localStorage.getItem(IZY_STORAGE_KEY);

        if (stored !== null) {
            const parsed = Number(stored);

            if (Number.isSafeInteger(parsed) && parsed >= 0) {
                savedCount = parsed;
            }
        }
    } catch (error) {
        console.warn("Não foi possível ler o resumo IzyPass:", error);
    }

    input.value = String(savedCount);
    updateIzyTotal();

    if (message) {
        message.textContent = "Valores carregados";
    }

    input.addEventListener("input", () => {
        updateIzyTotal();

        if (message) {
            message.textContent = "Alterações não salvas";
        }
    });

    input.addEventListener("change", () => {
        const value = Number(input.value);

        if (
            input.value.trim() === "" ||
            !Number.isSafeInteger(value) ||
            value < 0
        ) {
            if (message) {
                message.textContent =
                    "Informe uma quantidade inteira igual ou maior que zero.";
            }
        }
    });

    saveButton?.addEventListener("click", saveIzyPaidCount);
}

function updateIzyTotal() {
    const input = $("izyPaidCount");
    const total = $("izyTotalReceived");

    if (!input || !total) return;

    const raw = input.value.trim();
    const count = Number(raw);

    if (
        raw === "" ||
        !Number.isSafeInteger(count) ||
        count < 0
    ) {
        total.textContent = "—";
        return;
    }

    total.textContent = formatMoney(count * IZY_PRICE);
}

function saveIzyPaidCount() {
    const input = $("izyPaidCount");
    const button = $("saveIzyPaidCount");
    const message = $("izySalesMessage");

    if (!input || !button) return;

    const raw = input.value.trim();
    const count = Number(raw);

    if (
        raw === "" ||
        !Number.isSafeInteger(count) ||
        count < 0
    ) {
        if (message) {
            message.textContent =
                "Informe uma quantidade inteira válida.";
        }

        input.focus();
        return;
    }

    button.disabled = true;
    button.textContent = "SALVANDO...";

    try {
        localStorage.setItem(IZY_STORAGE_KEY, String(count));

        updateIzyTotal();

        if (message) {
            message.textContent =
                `Quantidade salva: ${count} pagamento(s) · ` +
                formatMoney(count * IZY_PRICE);
        }

        showMessage("Resumo IzyPass salvo neste navegador.");

    } catch (error) {
        console.error("Erro ao salvar resumo IzyPass:", error);

        if (message) {
            message.textContent =
                "Não foi possível salvar neste navegador.";
        }

        showMessage(
            "Falha ao salvar o resumo. Verifique as configurações do navegador."
        );

    } finally {
        button.disabled = false;
        button.textContent = "✓ Salvar quantidade";
    }
}

/* =========================================================
   CARREGAR INSCRIÇÕES
========================================================= */

async function loadRows() {
    if (!db || loadingRows) return;

    loadingRows = true;
    setLoading("Carregando inscrições...");

    try {
        const { data, error } = await db
            .from("inscricoes")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        allRows = Array.isArray(data) ? data : [];

        render();

    } catch (error) {
        console.error("Erro ao carregar inscrições:", error);

        if ($("tableBody")) {
            $("tableBody").innerHTML = `
                <tr>
                    <td colspan="7" class="empty-cell">
                        <strong>Erro ao carregar inscrições.</strong>
                        <br>
                        <small>${esc(
                            error?.message || "Erro desconhecido."
                        )}</small>
                    </td>
                </tr>
            `;
        }

        showMessage(
            "Erro ao carregar inscrições: " +
            (error?.message || "Erro desconhecido.")
        );

    } finally {
        loadingRows = false;
        setLoading("");
    }
}

/* =========================================================
   NORMALIZAÇÃO
========================================================= */

function normalizarTexto(value) {
    return String(value ?? "")
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function normalizarPagamento(value) {
    const status = normalizarTexto(value)
        .replace(/[\s-]+/g, "_");

    if (status === "PAGO_PARCEIRO") return "PAGO_PARCEIRO";
    if (status === "PAGO") return "PAGO";
    if (status === "CANCELADO") return "CANCELADO";
    if (status === "CORTESIA") return "CORTESIA";

    return "PENDENTE";
}

function pagamentoEstaVazio(value) {
    return (
        value === null ||
        value === undefined ||
        String(value).trim() === ""
    );
}

function normalizarStatusContato(value) {
    const status = normalizarTexto(value)
        .replace(/[\s-]+/g, "_");

    if ([
        "MENSAGEM_ENVIADA",
        "ENVIADA",
        "MENSAGEM"
    ].includes(status)) {
        return "MENSAGEM_ENVIADA";
    }

    if ([
        "RESPONDEU",
        "CLIENTE_RESPONDEU"
    ].includes(status)) {
        return "RESPONDEU";
    }

    if ([
        "NAO_RESPONDIDO",
        "NAO_RESPONDEU"
    ].includes(status)) {
        return "NAO_RESPONDIDO";
    }

    return "NOVO";
}

function textoStatusContato(status) {
    const labels = {
        MENSAGEM_ENVIADA: "MENSAGEM ENVIADA",
        RESPONDEU: "CLIENTE RESPONDEU",
        NAO_RESPONDIDO: "NÃO RESPONDIDO",
        NOVO: "NOVO"
    };

    return labels[normalizarStatusContato(status)];
}

function contactClass(status) {
    const classes = {
        MENSAGEM_ENVIADA: "contact-message",
        RESPONDEU: "contact-replied",
        NAO_RESPONDIDO: "contact-not-replied",
        NOVO: "contact-new"
    };

    return classes[normalizarStatusContato(status)];
}

/* =========================================================
   VALOR INDIVIDUAL DA INSCRIÇÃO
========================================================= */

function obterValorParticipante(participant) {
    const pagamento = normalizarPagamento(
        participant?.status_pagamento
    );

    if (pagamento === "PAGO_PARCEIRO") {
        return PARTNER_PRICE;
    }

    if (pagamento === "PAGO") {
        return IZY_PRICE;
    }

    const valor = participant?.valor;

    if (valor === null || valor === undefined || valor === "") {
        return IZY_PRICE;
    }

    const parsed = Number(valor);

    return Number.isFinite(parsed) ? parsed : IZY_PRICE;
}

/* =========================================================
   STATUS VISUAL DOS PARTICIPANTES
========================================================= */

function obterStatusVisualParticipante(row) {
    const pagamentoBruto = row.status_pagamento;
    const pagamento = normalizarPagamento(pagamentoBruto);
    const contato = normalizarStatusContato(row.status_contato);

    if (pagamento === "CORTESIA") {
        return {
            status: "CORTESIA",
            classe: "courtesy",
            titulo: "Inscrição cortesia"
        };
    }

    if (pagamento === "PAGO_PARCEIRO") {
        return {
            status: "PAGO PARCEIRO",
            classe: "paid-partner",
            titulo: "Pagamento parceiro confirmado — R$ 60,00"
        };
    }

    if (pagamento === "PAGO") {
        return {
            status: "PAGO",
            classe: "paid",
            titulo: "Pagamento confirmado — R$ 89,90"
        };
    }

    if (pagamento === "CANCELADO") {
        return {
            status: "CANCELADO",
            classe: "cancelled",
            titulo: "Inscrição cancelada"
        };
    }

    if (contato === "MENSAGEM_ENVIADA") {
        return {
            status: "MENSAGEM ENVIADA",
            classe: "contact-message",
            titulo: "Mensagem enviada"
        };
    }

    if (pagamentoEstaVazio(pagamentoBruto)) {
        return {
            status: "NOVO",
            classe: "contact-new",
            titulo: "Inscrição recente"
        };
    }

    return {
        status: "PENDENTE",
        classe: "pending",
        titulo: "Pagamento pendente"
    };
}

/* =========================================================
   FILTROS
========================================================= */

function filtered() {
    const q = normalizarTexto($("search")?.value || "");

    const payment = normalizarPagamentoFiltro(
        $("paymentFilter")?.value || ""
    );

    const route = normalizarTexto(
        $("routeFilter")?.value || ""
    );

    const shirt = normalizarTexto(
        $("shirtFilter")?.value || ""
    );

    return allRows.filter(row => {
        const searchable = normalizarTexto([
            row.nome,
            row.cpf,
            row.email,
            row.telefone
        ].join(" "));

        const statusPagamento =
            normalizarPagamento(row.status_pagamento);

        const percurso = normalizarTexto(row.percurso);
        const camiseta = normalizarTexto(row.camiseta);

        return (
            (!q || searchable.includes(q)) &&
            (!payment || statusPagamento === payment) &&
            (!route || percurso === route) &&
            (!shirt || camiseta === shirt)
        );
    });
}

function normalizarPagamentoFiltro(value) {
    const raw = String(value ?? "").trim();

    if (!raw) return "";

    return normalizarPagamento(raw);
}

/* =========================================================
   RENDERIZAR TABELA
========================================================= */

function render() {
    const rows = filtered();
    const count = $("count");
    const body = $("tableBody");

    if (count) {
        count.textContent =
            `${rows.length} ${
                rows.length === 1 ? "inscrição" : "inscrições"
            }`;
    }

    if (!body) return;

    if (!rows.length) {
        body.innerHTML = `
            <tr>
                <td colspan="7" class="empty-cell">
                    Nenhum participante encontrado.
                </td>
            </tr>
        `;
        return;
    }

    body.innerHTML = rows.map(row => {
        const pagamento = normalizarPagamento(row.status_pagamento);
        const visual = obterStatusVisualParticipante(row);

        return `
            <tr>
                <td class="participant-cell">
                    <div class="participant-name-line">

                        <button
                            type="button"
                            class="participant-name participant-name-button"
                            data-id="${esc(row.id)}"
                            title="Ver participante"
                        >${esc(row.nome || "—")}</button>

                        <span
                            class="participant-status-dot ${esc(visual.classe)}"
                            title="${esc(visual.titulo)}"
                            aria-label="${esc(visual.status)}"
                            role="status"
                        ></span>

                    </div>

                    ${row.email ? `
                        <small class="participant-email">
                            ${esc(row.email)}
                        </small>
                    ` : ""}
                </td>

                <td>${esc(formatCPF(row.cpf))}</td>
                <td>${esc(formatPhone(row.telefone))}</td>
                <td>${esc(row.percurso || "—")}</td>
                <td>${esc(row.camiseta || "—")}</td>

                <td>
                    <span class="status-badge ${paymentClass(pagamento)}">
                        ${esc(textoPagamento(pagamento))}
                    </span>
                </td>

                <td>
                    <button
                        type="button"
                        class="action-btn"
                        data-id="${esc(row.id)}"
                        aria-label="Ver detalhes de ${esc(row.nome || "participante")}"
                    >VER</button>
                </td>
            </tr>
        `;
    }).join("");
}

function textoPagamento(status) {
    const labels = {
        PAGO: "PAGO",
        PAGO_PARCEIRO: "PAGO PARCEIRO",
        PENDENTE: "PENDENTE",
        CANCELADO: "CANCELADO",
        CORTESIA: "CORTESIA"
    };

    return labels[status] || status;
}

/* =========================================================
   DETALHES DO PARTICIPANTE
========================================================= */

function renderParticipantDetails(participant) {
    const container = $("modalData");

    if (!container) return;

    const fields = [
        ["Nome completo", participant.nome],
        ["CPF", formatCPF(participant.cpf)],
        ["Data de nascimento", formatDate(participant.nascimento)],
        ["E-mail", participant.email],
        ["Telefone", formatPhone(participant.telefone)],
        ["Sexo", participant.sexo],
        ["Percurso", participant.percurso],
        ["Camiseta", participant.camiseta],
        ["Valor da inscrição", formatMoney(
            obterValorParticipante(participant)
        )],
        ["Pagamento", textoPagamento(
            normalizarPagamento(participant.status_pagamento)
        )],
        ["Cadastro realizado em", formatDateTime(
            participant.created_at
        )],
        ["Última atualização", formatDateTime(
            participant.updated_at
        )]
    ];

    container.innerHTML = fields.map(([label, value]) => `
        <div class="detail-item">
            <span class="detail-label">${esc(label)}</span>
            <strong class="detail-value">${esc(
                value === null ||
                value === undefined ||
                value === ""
                    ? "—"
                    : value
            )}</strong>
        </div>
    `).join("");
}

/* =========================================================
   ABRIR MODAL
========================================================= */

function openModal(id) {
    const participant = allRows.find(
        row => String(row.id) === String(id)
    );

    if (!participant) {
        showMessage("Participante não encontrado.");
        return;
    }

    const modal = $("editModal");

    if (!modal) {
        showMessage("Modal não encontrado. Verifique o HTML.");
        return;
    }

    selectedId = participant.id;

    if ($("modalName")) {
        $("modalName").textContent =
            participant.nome || "Participante";
    }

    if ($("modalPayment")) {
        $("modalPayment").value =
            normalizarPagamento(participant.status_pagamento);
    }

    renderParticipantDetails(participant);
    configurarComunicacao(participant);
    configurarAcompanhamentoContato(participant);

    modal.classList.remove("hidden");
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");

    document.body.classList.add("modal-open");

    $("closeModal")?.focus();
}

/* =========================================================
   FECHAR MODAL
========================================================= */

function closeModal() {
    const modal = $("editModal");

    if (modal) {
        modal.classList.add("hidden");
        modal.hidden = true;
        modal.setAttribute("aria-hidden", "true");
    }

    document.body.classList.remove("modal-open");

    selectedId = null;
}

/* =========================================================
   COMUNICAÇÃO — PAGAMENTO PENDENTE
========================================================= */


/* =========================================================
   COMUNICAÇÃO — WHATSAPP E E-MAIL
========================================================= */

function configurarComunicacao(participante) {
    const box = $("pendingCommunication");
    const whatsapp = $("whatsappBtn");
    const emailBtn = $("emailBtn");

    if (!box || !whatsapp) return;

    whatsapp.onclick = null;
    whatsapp.removeAttribute("href");

    if (emailBtn) {
        emailBtn.onclick = null;
        emailBtn.removeAttribute("href");
    }

    const pagamento = normalizarPagamento(
        participante.status_pagamento
    );

    const podeEnviar = [
        "PAGO",
        "PAGO_PARCEIRO",
        "PENDENTE"
    ].includes(pagamento);

    if (!podeEnviar) {
        box.classList.add("hidden");
        box.hidden = true;
        return;
    }

    box.classList.remove("hidden");
    box.hidden = false;

    const mensagem = criarMensagemPagamento(participante);
    const telefone = normalizarTelefone(participante.telefone);

    whatsapp.hidden = false;
    whatsapp.target = "_blank";
    whatsapp.rel = "noopener noreferrer";

    if (telefone) {
        whatsapp.href =
            "https://wa.me/" +
            telefone +
            "?text=" +
            encodeURIComponent(mensagem);
    } else {
        whatsapp.onclick = event => {
            event.preventDefault();

            showMessage(
                "Este participante não possui telefone cadastrado."
            );
        };
    }

    if (emailBtn) {
        const email = String(participante.email || "").trim();

        if (email) {
            emailBtn.hidden = false;
            emailBtn.href =
                "mailto:" +
                encodeURIComponent(email) +
                "?subject=" +
                encodeURIComponent("RUN & SAMBA — Confirmação de inscrição") +
                "&body=" +
                encodeURIComponent(mensagem);
        } else {
            emailBtn.hidden = true;
        }
    }
}

/* =========================================================
   MENSAGEM DE CONFIRMAÇÃO DOS DADOS
========================================================= */

function criarMensagemPagamento(participante) {
    const pagamento = normalizarPagamento(
        participante?.status_pagamento
    );

    const nomeCompleto = String(
        participante?.nome || "Participante"
    ).trim();

    const partesNome = nomeCompleto
        .split(/\s+/)
        .filter(Boolean);

    const primeiroSegundoETerceiroNome = partesNome
    .slice(0, 3)
    .join(" ");

    // PARTICIPANTES COM PAGAMENTO CONFIRMADO
    if (
        pagamento === "PAGO" ||
        pagamento === "PAGO_PARCEIRO"
    ) {
        const cpf = formatCPF(participante?.cpf);

        const percurso = String(
            participante?.percurso || "Não informado"
        ).trim();

        const camiseta = String(
            participante?.camiseta || "Não informado"
        ).trim();

        return `Olá, ${primeiroESegundoNome}! Tudo bem?

Estamos passando para confirmar seus dados da corrida RUN & SAMBA — 2ª EDIÇÃO.

Confira se está tudo certinho:

*Nome completo:* ${nomeCompleto}
*CPF:* ${cpf}
*Percurso:* ${percurso}
*Tamanho da camiseta:* ${camiseta}

Está tudo correto com seus dados?

Se precisar de alguma correção, é só nos avisar por aqui!`;
    }

    // PARTICIPANTES COM PAGAMENTO PENDENTE
return `Olá, ${primeiroSegundoETerceiroNome}! Tudo bem?`;}

/* =========================================================
   NORMALIZAR TELEFONE PARA WHATSAPP
========================================================= */

function normalizarTelefone(telefone) {
    let numero = String(telefone || "").replace(/\D/g, "");

    if (!numero) return "";

    // Remove o código internacional duplicado, se necessário.
    if (numero.startsWith("55") && numero.length > 11) {
        numero = numero.substring(2);
    }

    // Números brasileiros com DDD.
    if (numero.length !== 10 && numero.length !== 11) {
        return "";
    }

    // Acrescenta o código do Brasil.
    return "55" + numero;
}

/* =========================================================
   SALVAR PAGAMENTO
========================================================= */

async function savePayment() {
    if (selectedId === null || selectedId === undefined) {
        showMessage("Nenhum participante selecionado.");
        return;
    }

    const select = $("modalPayment");
    const button = $("savePayment");

    if (!select || !button || !db) return;

    const value = normalizarPagamento(select.value);
    const previousText = button.textContent;

    button.disabled = true;
    button.textContent = "SALVANDO...";

    try {
        const agora = new Date().toISOString();

        const dadosAtualizacao = {
            status_pagamento: value,
            updated_at: agora
        };

        /*
         * VALORES:
         * PAGO = R$ 89,90
         * PAGO_PARCEIRO = R$ 60,00
         *
         * PENDENTE, CANCELADO e CORTESIA
         * não alteram o valor armazenado.
         */

        if (value === "PAGO_PARCEIRO") {
    dadosAtualizacao.valor = PARTNER_PRICE;
} else if (
    value === "PAGO" ||
    value === "PENDENTE"
) {
    dadosAtualizacao.valor = IZY_PRICE;
}

        const { data, error } = await db
            .from("inscricoes")
            .update(dadosAtualizacao)
            .eq("id", selectedId)
            .select("*");

        if (error) throw error;

        if (!data || data.length === 0) {
            throw new Error(
                "Nenhuma inscrição foi atualizada. " +
                "Verifique as permissões RLS."
            );
        }

        const atualizado = data[0];

        const index = allRows.findIndex(
            row => String(row.id) === String(selectedId)
        );

        if (index !== -1) {
            allRows[index] = {
                ...allRows[index],
                ...atualizado
            };
        }

        render();

        renderParticipantDetails(atualizado);
        configurarComunicacao(atualizado);

        showMessage(
            value === "PAGO_PARCEIRO"
                ? "Pagamento parceiro confirmado: R$ 60,00."
                : value === "PAGO"
                    ? "Pagamento confirmado: R$ 89,90."
                    : value === "CORTESIA"
                        ? "Inscrição atualizada para CORTESIA."
                        : value === "CANCELADO"
                            ? "Inscrição atualizada para CANCELADO."
                            : "Pagamento atualizado para PENDENTE."
        );

    } catch (error) {
        console.error("Erro ao atualizar pagamento:", error);

        showMessage(
            "Erro ao atualizar pagamento: " +
            (error?.message || "Erro desconhecido.") +
            (
                error?.code === "23514"
                    ? " A restrição CHECK da coluna status_pagamento pode não permitir PAGO_PARCEIRO."
                    : ""
            )
        );

    } finally {
        button.disabled = false;
        button.textContent = previousText || "SALVAR PAGAMENTO";
    }
}

/* =========================================================
   F9 — ACOMPANHAMENTO DE CONTATO
========================================================= */

function configurarAcompanhamentoContato(participante) {
    const statusSelect = $("contactStatus");
    const responseField = $("clientResponse");
    const responseGroup = $("clientResponseGroup");

    if (!statusSelect || !responseField) return;

    const status = normalizarStatusContato(
        participante.status_contato
    );

    statusSelect.value = status;
    responseField.value = participante.resposta_cliente || "";

    atualizarCampoRespostaContato(status, responseGroup);

    statusSelect.onchange = function () {
        atualizarCampoRespostaContato(
            normalizarStatusContato(this.value),
            responseGroup
        );
    };
}

function atualizarCampoRespostaContato(status, responseGroup) {
    if (!responseGroup) return;

    const mostrar =
        normalizarStatusContato(status) === "RESPONDEU";

    responseGroup.hidden = !mostrar;
    responseGroup.style.display = mostrar ? "block" : "none";
}

async function saveContactFollowup() {
    if (selectedId === null || selectedId === undefined) {
        showMessage("Nenhum participante selecionado.");
        return;
    }

    const statusSelect = $("contactStatus");
    const responseField = $("clientResponse");
    const button = $("saveContactFollowup");

    if (!statusSelect || !responseField || !button || !db) {
        showMessage("Campos do acompanhamento não encontrados.");
        return;
    }

    const status = normalizarStatusContato(statusSelect.value);
    const resposta = responseField.value.trim();

    if (status === "RESPONDEU" && !resposta) {
        showMessage("Digite a resposta do cliente.");
        responseField.focus();
        return;
    }

    const previousText = button.textContent;

    button.disabled = true;
    button.textContent = "SALVANDO...";

    try {
        const agora = new Date().toISOString();

        const { data, error } = await db
            .from("inscricoes")
            .update({
                status_contato: status,
                resposta_cliente:
                    status === "RESPONDEU" ? resposta : null,
                contato_atualizado_em: agora
            })
            .eq("id", selectedId)
            .select("*");

        if (error) throw error;

        if (!data || data.length === 0) {
            throw new Error(
                "Nenhum registro foi atualizado. " +
                "Verifique as permissões RLS."
            );
        }

        const participant = allRows.find(
            row => String(row.id) === String(selectedId)
        );

        if (participant) {
            participant.status_contato = status;
            participant.resposta_cliente =
                status === "RESPONDEU" ? resposta : null;
            participant.contato_atualizado_em = agora;

            renderParticipantDetails(participant);
        }

        render();

        showMessage("Acompanhamento salvo com sucesso.");

    } catch (error) {
        console.error("Erro ao salvar acompanhamento:", error);

        showMessage(
            "Erro ao salvar acompanhamento: " +
            (error?.message || "Erro desconhecido.")
        );

    } finally {
        button.disabled = false;
        button.textContent =
            previousText || "SALVAR ACOMPANHAMENTO";
    }
}

/* =========================================================
   EXPORTAR CSV
========================================================= */

function exportCSV() {
    const rows = filtered();

    if (!rows.length) {
        showMessage("Não existem inscrições para exportar.");
        return;
    }

    const columns = [
        "id",
        "nome",
        "cpf",
        "nascimento",
        "email",
        "telefone",
        "sexo",
        "camiseta",
        "percurso",
        "valor",
        "status",
        "status_pagamento",
        "status_contato",
        "resposta_cliente",
        "contato_atualizado_em",
        "created_at"
    ];

    const csv = [
        columns.join(";"),
        ...rows.map(row =>
            columns.map(column => csvCell(row[column])).join(";")
        )
    ].join("\r\n");

    const blob = new Blob(["\ufeff" + csv], {
        type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "run-samba-inscricoes.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    showMessage(
        `${rows.length} ${
            rows.length === 1
                ? "inscrição exportada"
                : "inscrições exportadas"
        }.`
    );
}

function csvCell(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

/* =========================================================
   FORMATAÇÃO
========================================================= */

function formatCPF(cpf) {
    const value = String(cpf || "").replace(/\D/g, "");

    if (value.length !== 11) return cpf || "—";

    return value.replace(
        /(\d{3})(\d{3})(\d{3})(\d{2})/,
        "$1.$2.$3-$4"
    );
}

function formatPhone(phone) {
    const value = String(phone || "").replace(/\D/g, "");

    if (value.length === 13 && value.startsWith("55")) {
        return value.substring(2).replace(
            /(\d{2})(\d{5})(\d{4})/,
            "($1) $2-$3"
        );
    }

    if (value.length === 12 && value.startsWith("55")) {
        return value.substring(2).replace(
            /(\d{2})(\d{4})(\d{4})/,
            "($1) $2-$3"
        );
    }

    if (value.length === 11) {
        return value.replace(
            /(\d{2})(\d{5})(\d{4})/,
            "($1) $2-$3"
        );
    }

    if (value.length === 10) {
        return value.replace(
            /(\d{2})(\d{4})(\d{4})/,
            "($1) $2-$3"
        );
    }

    return phone || "—";
}

function formatDate(date) {
    if (!date) return "—";

    const value = String(date);

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split("-");
        return `${day}/${month}/${year}`;
    }

    const parsed = new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString("pt-BR");
    }

    return value;
}

function formatDateTime(date) {
    if (!date) return "—";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
        return String(date);
    }

    return parsed.toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short"
    });
}

function formatMoney(value) {
    if (value === null || value === undefined || value === "") {
        return "—";
    }

    let number;

    if (typeof value === "number") {
        number = value;
    } else {
        let normalized = String(value)
            .trim()
            .replace(/R\$\s?/gi, "")
            .replace(/\s/g, "");

        if (normalized.includes(",")) {
            normalized = normalized
                .replace(/\./g, "")
                .replace(",", ".");
        }

        number = Number(normalized);
    }

    if (!Number.isFinite(number)) return String(value);

    return number.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function paymentClass(value) {
    const status = normalizarPagamento(value);

    if (status === "PAGO") return "paid";
    if (status === "PAGO_PARCEIRO") return "paid-partner";
    if (status === "CANCELADO") return "cancelled";
    if (status === "CORTESIA") return "courtesy";

    return "pending";
}

/* =========================================================
   SEGURANÇA — ESCAPE HTML
========================================================= */

function esc(value) {
    const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    };

    return String(value ?? "").replace(
        /[&<>"']/g,
        character => entities[character]
    );
}

/* =========================================================
   MENSAGENS E CARREGAMENTO
========================================================= */

function showMessage(text) {
    const element = $("message");

    if (!element) {
        console.log(text);
        return;
    }

    element.textContent = text;
    element.classList.add("show");

    clearTimeout(showMessage.timer);

    showMessage.timer = setTimeout(() => {
        element.textContent = "";
        element.classList.remove("show");
    }, 5000);
}

function setLoading(text) {
    if ($("loading")) {
        $("loading").textContent = text;
    }
}

/* =========================================================
   INICIAR APLICAÇÃO
========================================================= */

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, {
        once: true
    });
} else {
    init();
}
