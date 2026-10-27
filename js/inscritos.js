/* =========================================================
   RUN & SAMBA 2026 — CRM INSCRITOS
   Administração • IzyPass • Pagamentos • Comunicação • F9

   STATUS VISUAIS:
   🟢 PAGO
   🔴 CANCELADO
   🔵 MENSAGEM ENVIADA
   🟡 PENDENTE
   ⚪ NOVO
   🟢 NEON CORTESIA

   RESPONDEU / NÃO RESPONDIDO:
   Exclusivamente no acompanhamento F9.

   IzyPass:
   - Valor de referência: R$ 89,90
   - Total = quantidade informada x R$ 89,90
   - Persistência local, sem alterar o banco.
========================================================= */

"use strict";

/* =========================================================
   ESTADO
========================================================= */

let db = null;
let allRows = [];
let selectedId = null;
let loadingRows = false;
let eventsBound = false;

const IZY_PRICE = 89.90;
const IZY_STORAGE_KEY = "run_samba_izy_paid_count_v1";

const $ = id => document.getElementById(id);

/* =========================================================
   INICIALIZAÇÃO E AUTORIZAÇÃO
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
   IZYPASS — RESUMO DE PAGAMENTOS INFORMADOS
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
        console.warn(
            "Não foi possível ler o resumo IzyPass:",
            error
        );
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
            return;
        }

        updateIzyTotal();
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
   EVENTOS GERAIS
========================================================= */

function bindEvents() {
    if (eventsBound) return;
    eventsBound = true;

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
        if (
            event.target === $("editModal") ||
            event.target.classList.contains("modal-overlay")
        ) {
            closeModal();
        }
    });

    $("logoutBtn")?.addEventListener("click", async () => {
        const button = $("logoutBtn");

        button.disabled = true;
        button.textContent = "SAINDO...";

        try {
            if (window.crmAuth?.logout) {
                await window.crmAuth.logout();
            } else if (db) {
                await db.auth.signOut();
                window.location.replace("index.html");
            }
        } catch (error) {
            console.error("Erro ao sair:", error);

            button.disabled = false;
            button.textContent = "SAIR";

            showMessage("Não foi possível sair. Tente novamente.");
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            const modal = $("editModal");

            if (modal && !modal.classList.contains("hidden")) {
                closeModal();
            }
        }

        if (event.key === "F9") {
            const modal = $("editModal");

            if (modal && !modal.classList.contains("hidden")) {
                event.preventDefault();
                $("contactStatus")?.focus();
            }
        }
    });
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
    const status = normalizarTexto(value);

    if (status === "PAGO") return "PAGO";
    if (status === "CANCELADO") return "CANCELADO";
    if (status === "CORTESIA") return "CORTESIA";

    return "PENDENTE";
}

function pagamentoEstaVazio(value) {
    return value === null ||
        value === undefined ||
        String(value).trim() === "";
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
   STATUS VISUAL DOS PARTICIPANTES
========================================================= */

function obterStatusVisualParticipante(row) {
    const pagamentoBruto = row.status_pagamento;
    const pagamento = normalizarTexto(pagamentoBruto);
    const contato = normalizarStatusContato(row.status_contato);

    // Cortesia tem prioridade sobre os estados de contato.
    if (pagamento === "CORTESIA") {
        return {
            status: "CORTESIA",
            classe: "courtesy",
            titulo: "Inscrição cortesia"
        };
    }

    if (pagamento === "PAGO") {
        return {
            status: "PAGO",
            classe: "paid",
            titulo: "Pagamento confirmado"
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

    const payment = normalizarTexto(
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
                        ${esc(pagamento)}
                    </span>
                </td>

                <td>
                    <button
                        type="button"
                        class="action-btn"
                        data-id="${esc(row.id)}"
                    >VER</button>
                </td>
            </tr>
        `;
    }).join("");

    body.querySelectorAll(
        ".action-btn, .participant-name-button"
    ).forEach(button => {
        button.addEventListener("click", () => {
            openModal(button.dataset.id);
        });
    });
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

    $("editModal")?.classList.remove("hidden");
    document.body.classList.add("modal-open");

    setTimeout(() => $("modalPayment")?.focus(), 100);
}

function renderParticipantDetails(participant) {
    const fields = [
        ["CPF", formatCPF(participant.cpf)],
        ["Nascimento", formatDate(participant.nascimento)],
        ["E-mail", participant.email],
        ["Telefone", formatPhone(participant.telefone)],
        ["Sexo", participant.sexo],
        ["Camiseta", participant.camiseta],
        ["Percurso", participant.percurso],
        ["Valor", formatMoney(participant.valor)],
        ["Status", participant.status],
        [
            "Pagamento",
            normalizarPagamento(participant.status_pagamento)
        ],
        [
            "Contato",
            textoStatusContato(participant.status_contato)
        ]
    ];

    if ($("modalData")) {
        $("modalData").innerHTML = fields.map(([label, value]) => `
            <div class="detail-item">
                <span>${esc(label)}</span>
                <strong>${esc(value ?? "—")}</strong>
            </div>
        `).join("");
    }
}

/* =========================================================
   FECHAR MODAL
========================================================= */

function closeModal() {
    $("editModal")?.classList.add("hidden");
    document.body.classList.remove("modal-open");
    selectedId = null;
}

/* =========================================================
   COMUNICAÇÃO — SOMENTE PAGAMENTO PENDENTE
========================================================= */

function configurarComunicacao(participante) {
    const box = $("pendingCommunication");
    const whatsapp = $("whatsappBtn");
    const emailBtn = $("emailBtn");

    if (!box || !whatsapp || !emailBtn) return;

    whatsapp.onclick = null;
    emailBtn.onclick = null;

    whatsapp.removeAttribute("href");
    emailBtn.removeAttribute("href");

    const pagamento = normalizarPagamento(
        participante.status_pagamento
    );

    // Cortesia, pago e cancelado não exibem cobrança de pendência.
    if (pagamento !== "PENDENTE") {
        box.classList.add("hidden");
        return;
    }

    box.classList.remove("hidden");

    const mensagem = criarMensagemPagamento(participante.nome);
    const numero = normalizarTelefone(participante.telefone);
    const email = String(participante.email || "").trim();

    whatsapp.target = "_blank";
    whatsapp.rel = "noopener noreferrer";

    if (numero) {
        whatsapp.href =
            "https://wa.me/" + numero +
            "?text=" + encodeURIComponent(mensagem);
    } else {
        whatsapp.onclick = event => {
            event.preventDefault();
            showMessage(
                "Este participante não possui telefone cadastrado."
            );
        };
    }

    emailBtn.target = "_blank";
    emailBtn.rel = "noopener noreferrer";

    if (email) {
        emailBtn.href =
            "https://mail.google.com/mail/?view=cm&fs=1" +
            "&to=" + encodeURIComponent(email) +
            "&su=" + encodeURIComponent(criarAssuntoEmail()) +
            "&body=" + encodeURIComponent(mensagem);
    } else {
        emailBtn.onclick = event => {
            event.preventDefault();
            showMessage(
                "Este participante não possui e-mail cadastrado."
            );
        };
    }
}

function normalizarTelefone(telefone) {
    let numero = String(telefone || "").replace(/\D/g, "");

    if (!numero) return "";

    if (numero.startsWith("55")) {
        return numero;
    }

    if (numero.length === 10 || numero.length === 11) {
        return "55" + numero;
    }

    return numero;
}

function criarMensagemPagamento(nome) {
    const primeiroNome = String(nome || "participante")
        .trim()
        .split(/\s+/)[0];

    return `Olá, ${primeiroNome}!
Tudo bem?`;
}

function criarAssuntoEmail() {
    return "Última chance: 2º lote da Run & Samba está chegando!";
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

        const { data, error } = await db
            .from("inscricoes")
            .update({
                status_pagamento: value,
                updated_at: agora
            })
            .eq("id", selectedId)
            .select("*");

        if (error) throw error;

        if (!data || data.length === 0) {
            throw new Error(
                "Nenhuma inscrição foi atualizada. " +
                "Verifique as permissões RLS."
            );
        }

        const item = allRows.find(
            row => String(row.id) === String(selectedId)
        );

        if (item) {
            item.status_pagamento = value;
            item.updated_at = agora;
        }

        render();

        if (item) {
            renderParticipantDetails(item);
            configurarComunicacao(item);
        }

        showMessage(
            value === "CORTESIA"
                ? "Inscrição atualizada para CORTESIA."
                : "Pagamento atualizado com sucesso."
        );

    } catch (error) {
        console.error("Erro ao atualizar pagamento:", error);

        showMessage(
            "Erro ao atualizar pagamento: " +
            (error?.message || "Erro desconhecido.") +
            (
                error?.code === "23514"
                    ? " A coluna status_pagamento pode ter uma restrição CHECK que ainda não permite CORTESIA."
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

    responseGroup.style.display =
        normalizarStatusContato(status) === "RESPONDEU"
            ? "block"
            : "none";
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

        // RESPONDEU / NÃO RESPONDIDO não alteram a bolinha.
        // MENSAGEM ENVIADA continua representada em azul,
        // exceto quando o pagamento é CORTESIA, PAGO ou CANCELADO.
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
   FORMATAÇÃO DE DADOS
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
    if (status === "CANCELADO") return "cancelled";
    if (status === "CORTESIA") return "courtesy";

    return "pending";
}

/* =========================================================
   ESCAPE HTML
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
