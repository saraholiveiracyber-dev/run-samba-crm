/* =========================================================
   RUN & SAMBA 2026
   CRM — INSCRITOS
   PARTICIPANTES + PAGAMENTO + COMUNICAÇÃO + F9

   STATUS VISUAL AO LADO DO NOME:
   🟢 PAGO
   🔴 CANCELADO
   🔵 MENSAGEM ENVIADA
   🟡 PENDENTE
   ⚪ NOVO

   F9:
   - MENSAGEM ENVIADA
   - CLIENTE RESPONDEU
   - NÃO RESPONDIDO
   - NOVO

   CLIENTE RESPONDEU / NÃO RESPONDIDO:
   NÃO aparecem na bolinha do participante.
   ========================================================= */

"use strict";


/* =========================================================
   ESTADO
   ========================================================= */

let db = null;
let allRows = [];
let selectedId = null;


/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

async function init() {

    try {

        /* =====================================================
           SUPABASE
        ===================================================== */

        db = window.supabaseClient;

        if (!db) {

            showMessage(
                "Supabase não foi inicializado. Verifique o config.js."
            );

            return;
        }


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
           EVENTOS
        ===================================================== */

        bindEvents();


        /* =====================================================
           CARREGAR DADOS
        ===================================================== */

        await loadRows();


    } catch (error) {

        console.error(
            "Erro na inicialização do CRM:",
            error
        );

        showMessage(
            "Erro ao iniciar o CRM: " +
            (
                error?.message ||
                "Erro desconhecido."
            )
        );

    }

}


/* =========================================================
   CARREGAR INSCRIÇÕES
   ========================================================= */

async function loadRows() {

    setLoading("Carregando inscrições...");


    try {

        const {
            data,
            error
        } = await db
            .from("inscricoes")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


        if (error) {
            throw error;
        }


        allRows =
            Array.isArray(data)
                ? data
                : [];


        render();


    } catch (error) {

        console.error(
            "Erro Supabase:",
            error
        );


        const body =
            document.getElementById(
                "tableBody"
            );


        if (body) {

            body.innerHTML = `
                <tr>
                    <td
                        colspan="7"
                        class="empty-cell"
                    >
                        <strong>
                            Erro ao carregar inscrições.
                        </strong>

                        <br>

                        <small>
                            ${esc(error?.message || "Erro desconhecido.")}
                        </small>
                    </td>
                </tr>
            `;

        }


        showMessage(
            "Erro ao carregar inscrições: " +
            (
                error?.message ||
                "Erro desconhecido."
            )
        );

    } finally {

        setLoading("");

    }

}


/* =========================================================
   EVENTOS
   ========================================================= */

function bindEvents() {


    /* =====================================================
       FILTROS
    ===================================================== */

    [
        "search",
        "paymentFilter",
        "routeFilter",
        "shirtFilter"
    ].forEach(id => {

        const element =
            document.getElementById(id);

        if (!element) {
            return;
        }


        element.addEventListener(
            "input",
            render
        );


        element.addEventListener(
            "change",
            render
        );

    });


    /* =====================================================
       EXPORTAR
    ===================================================== */

    const exportBtn =
        document.getElementById(
            "exportBtn"
        );


    if (exportBtn) {

        exportBtn.addEventListener(
            "click",
            exportCSV
        );

    }


    /* =====================================================
       FECHAR MODAL
    ===================================================== */

    const closeBtn =
        document.getElementById(
            "closeModal"
        );


    if (closeBtn) {

        closeBtn.addEventListener(
            "click",
            closeModal
        );

    }


    /* =====================================================
       OVERLAY
    ===================================================== */

    const modal =
        document.getElementById(
            "editModal"
        );


    if (modal) {

        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target === modal ||
                    event.target.classList.contains(
                        "modal-overlay"
                    )
                ) {

                    closeModal();

                }

            }
        );

    }


    /* =====================================================
       SALVAR PAGAMENTO
    ===================================================== */

    const savePaymentBtn =
        document.getElementById(
            "savePayment"
        );


    if (savePaymentBtn) {

        savePaymentBtn.addEventListener(
            "click",
            savePayment
        );

    }


    /* =====================================================
       SALVAR F9
    ===================================================== */

    const saveContactBtn =
        document.getElementById(
            "saveContactFollowup"
        );


    if (saveContactBtn) {

        saveContactBtn.addEventListener(
            "click",
            saveContactFollowup
        );

    }


    /* =====================================================
       ESC
    ===================================================== */

    document.addEventListener(
        "keydown",
        event => {

            if (event.key !== "Escape") {
                return;
            }


            const modal =
                document.getElementById(
                    "editModal"
                );


            if (
                modal &&
                !modal.classList.contains(
                    "hidden"
                )
            ) {

                closeModal();

            }

        }
    );


    /* =====================================================
       LOGOUT
    ===================================================== */

    const logoutBtn =
        document.getElementById(
            "logoutBtn"
        );


    if (
        logoutBtn &&
        window.crmAuth &&
        typeof window.crmAuth.logout === "function"
    ) {

        logoutBtn.addEventListener(
            "click",
            async () => {

                logoutBtn.disabled = true;
                logoutBtn.textContent = "SAINDO...";


                try {

                    await window.crmAuth.logout();

                } catch (error) {

                    console.error(
                        "Erro ao sair:",
                        error
                    );


                    logoutBtn.disabled = false;
                    logoutBtn.textContent = "SAIR";

                }

            }
        );

    }

}


/* =========================================================
   FILTRAR
   ========================================================= */

function filtered() {

    const searchElement =
        document.getElementById(
            "search"
        );


    const paymentElement =
        document.getElementById(
            "paymentFilter"
        );


    const routeElement =
        document.getElementById(
            "routeFilter"
        );


    const shirtElement =
        document.getElementById(
            "shirtFilter"
        );


    const q =
        String(
            searchElement?.value || ""
        )
            .toLowerCase()
            .trim();


    const payment =
        String(
            paymentElement?.value || ""
        )
            .trim()
            .toUpperCase();


    const route =
        String(
            routeElement?.value || ""
        )
            .trim()
            .toUpperCase();


    const shirt =
        String(
            shirtElement?.value || ""
        )
            .trim()
            .toUpperCase();


    return allRows.filter(row => {


        /* =================================================
           BUSCA
        ================================================= */

        const text = [

            row.nome,
            row.cpf,
            row.email,
            row.telefone

        ]
            .map(
                value =>
                    String(value ?? "")
            )
            .join(" ")
            .toLowerCase();


        /* =================================================
           PAGAMENTO
        ================================================= */

        const statusPagamento =
            normalizarPagamento(
                row.status_pagamento
            );


        /* =================================================
           PERCURSO
        ================================================= */

        const percurso =
            String(
                row.percurso ?? ""
            )
                .trim()
                .toUpperCase();


        /* =================================================
           CAMISETA
        ================================================= */

        const camiseta =
            String(
                row.camiseta ?? ""
            )
                .trim()
                .toUpperCase();


        return (

            (!q || text.includes(q)) &&

            (!payment ||
                statusPagamento === payment) &&

            (!route ||
                percurso === route) &&

            (!shirt ||
                camiseta === shirt)

        );

    });

}


/* =========================================================
   NORMALIZAR PAGAMENTO
   ========================================================= */

function normalizarPagamento(value) {

    const status =
        String(value ?? "")
            .trim()
            .toUpperCase()
            .normalize("NFD")
            .replace(
                /[\u0300-\u036f]/g,
                ""
            );


    if (status === "PAGO") {
        return "PAGO";
    }


    if (status === "CANCELADO") {
        return "CANCELADO";
    }


    return "PENDENTE";

}


/* =========================================================
   VERIFICAR PAGAMENTO VAZIO
   ========================================================= */

function pagamentoEstaVazio(value) {

    return (
        value === null ||
        value === undefined ||
        String(value).trim() === ""
    );

}


/* =========================================================
   NORMALIZAR STATUS DO CONTATO
   ========================================================= */

function normalizarStatusContato(value) {

    const status =
        String(value ?? "")
            .trim()
            .toUpperCase()
            .normalize("NFD")
            .replace(
                /[\u0300-\u036f]/g,
                ""
            )
            .replace(
                /[\s-]+/g,
                "_"
            );


    if (
        status === "MENSAGEM_ENVIADA" ||
        status === "ENVIADA" ||
        status === "MENSAGEM"
    ) {

        return "MENSAGEM_ENVIADA";

    }


    if (
        status === "RESPONDEU" ||
        status === "CLIENTE_RESPONDEU"
    ) {

        return "RESPONDEU";

    }


    if (
        status === "NAO_RESPONDIDO" ||
        status === "NAO_RESPONDEU"
    ) {

        return "NAO_RESPONDIDO";

    }


    if (status === "NOVO") {
        return "NOVO";
    }


    return "NOVO";

}


/* =========================================================
   TEXTO DO STATUS DO CONTATO
   ========================================================= */

function textoStatusContato(status) {

    switch (
        normalizarStatusContato(status)
    ) {

        case "MENSAGEM_ENVIADA":
            return "MENSAGEM ENVIADA";


        case "RESPONDEU":
            return "CLIENTE RESPONDEU";


        case "NAO_RESPONDIDO":
            return "NÃO RESPONDIDO";


        case "NOVO":
            return "NOVO";


        default:
            return "NOVO";

    }

}


/* =========================================================
   CLASSE DO STATUS DO CONTATO
   ========================================================= */

function contactClass(status) {

    switch (
        normalizarStatusContato(status)
    ) {

        case "MENSAGEM_ENVIADA":
            return "contact-message";


        case "RESPONDEU":
            return "contact-replied";


        case "NAO_RESPONDIDO":
            return "contact-not-replied";


        case "NOVO":
            return "contact-new";


        default:
            return "contact-new";

    }

}


/* =========================================================
   STATUS VISUAL DO PARTICIPANTE
   ========================================================= */

function obterStatusVisualParticipante(row) {

    const pagamentoBruto =
        row.status_pagamento;


    const pagamento =
        normalizarPagamento(
            pagamentoBruto
        );


    const contato =
        normalizarStatusContato(
            row.status_contato
        );


    /* =====================================================
       1 — PAGO
    ===================================================== */

    if (pagamento === "PAGO") {

        return {

            status: "PAGO",

            classe: "paid",

            titulo: "Pagamento confirmado"

        };

    }


    /* =====================================================
       2 — CANCELADO
    ===================================================== */

    if (pagamento === "CANCELADO") {

        return {

            status: "CANCELADO",

            classe: "cancelled",

            titulo: "Inscrição cancelada"

        };

    }


    /* =====================================================
       3 — MENSAGEM ENVIADA
    ===================================================== */

    if (
        contato === "MENSAGEM_ENVIADA"
    ) {

        return {

            status: "MENSAGEM ENVIADA",

            classe: "contact-message",

            titulo: "Mensagem enviada"

        };

    }


    /* =====================================================
       4 — NOVO
    ===================================================== */

    if (
        pagamentoEstaVazio(
            pagamentoBruto
        ) &&
        contato === "NOVO"
    ) {

        return {

            status: "NOVO",

            classe: "contact-new",

            titulo: "Inscrição recente"

        };

    }


    /* =====================================================
       5 — PENDENTE
    ===================================================== */

    if (pagamento === "PENDENTE") {

        return {

            status: "PENDENTE",

            classe: "pending",

            titulo: "Pagamento pendente"

        };

    }


    /* =====================================================
       FALLBACK
    ===================================================== */

    return {

        status: "NOVO",

        classe: "contact-new",

        titulo: "Inscrição recente"

    };

}


/* =========================================================
   CRIAR STATUS DO PARTICIPANTE

   IMPORTANTE:
   O NOME AGORA É CLICÁVEL.
   Clicar no nome abre o mesmo modal do botão VER.
   ========================================================= */

function criarStatusParticipante(row) {

    const visual =
        obterStatusVisualParticipante(row);


    return `

        <div class="participant-name-line">

            <button
                type="button"
                class="participant-name participant-name-button"
                data-id="${esc(row.id)}"
                title="Ver participante"
            >
                ${esc(row.nome || "—")}
            </button>


            <span
                class="participant-status-dot ${esc(visual.classe)}"
                title="${esc(visual.titulo)}"
                aria-label="${esc(visual.status)}"
                role="status"
            ></span>

        </div>


        ${
            row.email
                ? `
                    <small class="participant-email">
                        ${esc(row.email)}
                    </small>
                `
                : ""
        }

    `;

}


/* =========================================================
   RENDERIZAR TABELA
   ========================================================= */

function render() {

    const rows =
        filtered();


    /* =====================================================
       CONTADOR
    ===================================================== */

    const count =
        document.getElementById(
            "count"
        );


    if (count) {

        count.textContent =
            `${rows.length} ${
                rows.length === 1
                    ? "inscrição"
                    : "inscrições"
            }`;

    }


    /* =====================================================
       TABELA
    ===================================================== */

    const body =
        document.getElementById(
            "tableBody"
        );


    if (!body) {
        return;
    }


    /* =====================================================
       NENHUM RESULTADO
    ===================================================== */

    if (!rows.length) {

        body.innerHTML = `

            <tr>

                <td
                    colspan="7"
                    class="empty-cell"
                >
                    Nenhum participante encontrado.
                </td>

            </tr>

        `;

        return;
    }


    /* =====================================================
       LINHAS
    ===================================================== */

    body.innerHTML =
        rows
            .map(row => {

                const pagamento =
                    normalizarPagamento(
                        row.status_pagamento
                    );


                return `

                    <tr>

                        <!-- PARTICIPANTE -->

                        <td class="participant-cell">

                            ${criarStatusParticipante(row)}

                        </td>


                        <!-- CPF -->

                        <td>

                            ${esc(
                                formatCPF(row.cpf)
                            )}

                        </td>


                        <!-- TELEFONE -->

                        <td>

                            ${esc(
                                formatPhone(row.telefone)
                            )}

                        </td>


                        <!-- PERCURSO -->

                        <td>

                            ${esc(
                                row.percurso || "—"
                            )}

                        </td>


                        <!-- CAMISETA -->

                        <td>

                            ${esc(
                                row.camiseta || "—"
                            )}

                        </td>


                        <!-- PAGAMENTO -->

                        <td>

                            <span
                                class="status-badge ${paymentClass(
                                    pagamento
                                )}"
                            >
                                ${esc(pagamento)}
                            </span>

                        </td>


                        <!-- AÇÕES -->

                        <td>

                            <button
                                type="button"
                                class="action-btn"
                                data-id="${esc(row.id)}"
                            >
                                VER
                            </button>

                        </td>

                    </tr>

                `;

            })
            .join("");


    /* =====================================================
       BOTÕES VER
    ===================================================== */

    body
        .querySelectorAll(".action-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    openModal(
                        button.dataset.id
                    );

                }
            );

        });


    /* =====================================================
       NOME CLICÁVEL
    ===================================================== */

    body
        .querySelectorAll(".participant-name-button")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    openModal(
                        button.dataset.id
                    );

                }
            );

        });

}


/* =========================================================
   ABRIR MODAL
   ========================================================= */

function openModal(id) {

    const participant =
        allRows.find(
            row =>
                String(row.id) ===
                String(id)
        );


    if (!participant) {

        showMessage(
            "Participante não encontrado."
        );

        return;
    }


    selectedId =
        participant.id;


    const modal =
        document.getElementById(
            "editModal"
        );


    const modalName =
        document.getElementById(
            "modalName"
        );


    const modalPayment =
        document.getElementById(
            "modalPayment"
        );


    const modalData =
        document.getElementById(
            "modalData"
        );


    if (!modal) {
        return;
    }


    /* =====================================================
       NOME
    ===================================================== */

    if (modalName) {

        modalName.textContent =
            participant.nome ||
            "Participante";

    }


    /* =====================================================
       PAGAMENTO
    ===================================================== */

    const pagamento =
        normalizarPagamento(
            participant.status_pagamento
        );


    if (modalPayment) {

        modalPayment.value =
            pagamento;

    }


    /* =====================================================
       CONTATO
    ===================================================== */

    const contato =
        normalizarStatusContato(
            participant.status_contato
        );


    /* =====================================================
       DADOS
    ===================================================== */

    const fields = [

        [
            "CPF",
            formatCPF(participant.cpf)
        ],

        [
            "Nascimento",
            formatDate(participant.nascimento)
        ],

        [
            "E-mail",
            participant.email
        ],

        [
            "Telefone",
            formatPhone(participant.telefone)
        ],

        [
            "Sexo",
            participant.sexo
        ],

        [
            "Camiseta",
            participant.camiseta
        ],

        [
            "Percurso",
            participant.percurso
        ],

        [
            "Valor",
            formatMoney(participant.valor)
        ],

        [
            "Status",
            participant.status
        ],

        [
            "Pagamento",
            pagamento
        ],

        [
            "Contato",
            textoStatusContato(contato)
        ]

    ];


    if (modalData) {

        modalData.innerHTML =
            fields
                .map(
                    ([label, value]) => `

                        <div class="detail-item">

                            <span>
                                ${esc(label)}
                            </span>

                            <strong>
                                ${esc(
                                    value ?? "—"
                                )}
                            </strong>

                        </div>

                    `
                )
                .join("");

    }


    /* =====================================================
       COMUNICAÇÃO
    ===================================================== */

    configurarComunicacao(
        participant
    );


    /* =====================================================
       F9
    ===================================================== */

    configurarAcompanhamentoContato(
        participant
    );


    /* =====================================================
       ABRIR MODAL
    ===================================================== */

    modal.classList.remove(
        "hidden"
    );


    document.body.classList.add(
        "modal-open"
    );


    /* =====================================================
       FOCO
    ===================================================== */

    setTimeout(
        () => {

            if (modalPayment) {

                modalPayment.focus();

            }

        },
        100
    );

}


/* =========================================================
   CONFIGURAR COMUNICAÇÃO
   ========================================================= */

function configurarComunicacao(
    participante
) {

    const communicationBox =
        document.getElementById(
            "pendingCommunication"
        );


    const whatsappBtn =
        document.getElementById(
            "whatsappBtn"
        );


    const emailBtn =
        document.getElementById(
            "emailBtn"
        );


    if (
        !communicationBox ||
        !whatsappBtn ||
        !emailBtn
    ) {

        return;

    }


    const pagamento =
        normalizarPagamento(
            participante.status_pagamento
        );


    /* =====================================================
       SÓ MOSTRAR PARA PAGAMENTO PENDENTE
    ===================================================== */

    if (pagamento !== "PENDENTE") {

        communicationBox.classList.add(
            "hidden"
        );


        whatsappBtn.removeAttribute(
            "href"
        );


        emailBtn.removeAttribute(
            "href"
        );


        whatsappBtn.onclick = null;
        emailBtn.onclick = null;


        return;

    }


    /* =====================================================
       MOSTRAR
    ===================================================== */

    communicationBox.classList.remove(
        "hidden"
    );


    const nome =
        participante.nome ||
        "participante";


    const telefone =
        participante.telefone ||
        "";


    const email =
        participante.email ||
        "";


    const mensagem =
        criarMensagemPagamento(
            nome
        );


    /* =====================================================
       WHATSAPP
    ===================================================== */

    const numero =
        normalizarTelefone(
            telefone
        );


    whatsappBtn.onclick = null;

    whatsappBtn.removeAttribute(
        "href"
    );


    whatsappBtn.target =
        "_blank";


    whatsappBtn.rel =
        "noopener noreferrer";


    if (numero) {

        whatsappBtn.href =
            "https://wa.me/" +
            numero +
            "?text=" +
            encodeURIComponent(
                mensagem
            );

    } else {

        whatsappBtn.onclick =
            function(event) {

                event.preventDefault();

                alert(
                    "Este participante não possui telefone cadastrado."
                );

            };

    }


    /* =====================================================
       E-MAIL
    ===================================================== */

    emailBtn.onclick = null;

    emailBtn.removeAttribute(
        "href"
    );


    emailBtn.target =
        "_blank";


    emailBtn.rel =
        "noopener noreferrer";


    if (email) {

        const assunto =
            criarAssuntoEmail();


        const gmailUrl =
            "https://mail.google.com/mail/?view=cm" +
            "&fs=1" +
            "&to=" +
            encodeURIComponent(
                email
            ) +
            "&su=" +
            encodeURIComponent(
                assunto
            ) +
            "&body=" +
            encodeURIComponent(
                mensagem
            );


        emailBtn.href =
            gmailUrl;

    } else {

        emailBtn.onclick =
            function(event) {

                event.preventDefault();

                alert(
                    "Este participante não possui e-mail cadastrado."
                );

            };

    }

}


/* =========================================================
   NORMALIZAR TELEFONE
   ========================================================= */

function normalizarTelefone(
    telefone
) {

    if (!telefone) {
        return "";
    }


    let numero =
        String(telefone)
            .replace(
                /\D/g,
                ""
            );


    if (
        numero.startsWith("55")
    ) {

        return numero;

    }


    if (
        numero.length === 10 ||
        numero.length === 11
    ) {

        numero =
            "55" +
            numero;

    }


    return numero;

}


/* =========================================================
   MENSAGEM WHATSAPP
   ========================================================= */

function criarMensagemPagamento(nome) {

    const primeiroNome =
        String(
            nome || "participante"
        )
            .trim()
            .split(/\s+/)[0];


    return `Olá, ${primeiroNome}!

Aqui é da organização da RUN & SAMBA – 2ª Edição.

Identificamos que sua inscrição foi iniciada, porém o pagamento ainda não foi confirmado.

Estamos nos últimos dias do lote atual, e a mudança para o 2º lote está próxima. Após essa virada, os valores serão atualizados.

Por isso, se você deseja participar da RUN & SAMBA, este é o momento de confirmar sua inscrição pelo valor atual.

RUN & SAMBA – 2ª EDIÇÃO

20 de novembro de 2026
Luziânia – GO
Percursos de 5K e 10K

Finalize seu pagamento pelo link oficial da inscrição:

https://izypass.com.br/evento/run-and-samba-2-edicao_luziania_20-11-2026

Não deixe para depois. Após o encerramento do lote atual, não será possível garantir o valor vigente.

Esperamos você na linha de largada para viver essa experiência com a gente.

RUN & SAMBA
Corra. Sinta. Viva.

Atenciosamente,
Organização Run & Samba`;

}


/* =========================================================
   ASSUNTO E-MAIL
   ========================================================= */

function criarAssuntoEmail() {

    return (
        "Última chance: 2º lote da Run & Samba está chegando!"
    );

}


/* =========================================================
   FECHAR MODAL
   ========================================================= */

function closeModal() {

    const modal =
        document.getElementById(
            "editModal"
        );


    if (modal) {

        modal.classList.add(
            "hidden"
        );

    }


    document.body.classList.remove(
        "modal-open"
    );


    selectedId =
        null;

}


/* =========================================================
   SALVAR PAGAMENTO
   ========================================================= */

async function savePayment() {

    if (!selectedId) {

        showMessage(
            "Nenhum participante selecionado."
        );

        return;
    }


    if (!db) {

        showMessage(
            "Supabase não está disponível."
        );

        return;
    }


    const select =
        document.getElementById(
            "modalPayment"
        );


    const btn =
        document.getElementById(
            "savePayment"
        );


    if (!select || !btn) {
        return;
    }


    const value =
        normalizarPagamento(
            select.value
        );


    btn.disabled = true;

    btn.textContent =
        "SALVANDO...";


    try {

        const agora =
            new Date().toISOString();


        const {
            error
        } = await db
            .from("inscricoes")
            .update({

                status_pagamento:
                    value,

                updated_at:
                    agora

            })
            .eq(
                "id",
                selectedId
            );


        if (error) {
            throw error;
        }


        /* =================================================
           MEMÓRIA LOCAL
        ================================================= */

        const item =
            allRows.find(
                row =>
                    String(row.id) ===
                    String(selectedId)
            );


        if (item) {

            item.status_pagamento =
                value;

            item.updated_at =
                agora;

        }


        /* =================================================
           ATUALIZAR TABELA
        ================================================= */

        render();


        /* =================================================
           ATUALIZAR COMUNICAÇÃO
        ================================================= */

        if (item) {

            configurarComunicacao(
                item
            );

        }


        showMessage(
            "Pagamento atualizado com sucesso."
        );


    } catch (error) {

        console.error(
            "Erro ao atualizar pagamento:",
            error
        );


        showMessage(
            "Erro ao atualizar pagamento: " +
            (
                error?.message ||
                "Erro desconhecido."
            )
        );


    } finally {

        btn.disabled = false;

        btn.textContent =
            "SALVAR PAGAMENTO";

    }

}


/* =========================================================
   F9 — CONFIGURAR ACOMPANHAMENTO
   ========================================================= */

function configurarAcompanhamentoContato(
    participante
) {

    const statusSelect =
        document.getElementById(
            "contactStatus"
        );


    const responseField =
        document.getElementById(
            "clientResponse"
        );


    const responseGroup =
        document.getElementById(
            "clientResponseGroup"
        );


    if (
        !statusSelect ||
        !responseField
    ) {

        return;

    }


    /* =====================================================
       STATUS
    ===================================================== */

    const status =
        normalizarStatusContato(
            participante.status_contato
        );


    statusSelect.value =
        status;


    /* =====================================================
       RESPOSTA
    ===================================================== */

    responseField.value =
        participante.resposta_cliente ||
        "";


    /* =====================================================
       MOSTRAR / OCULTAR
    ===================================================== */

    atualizarCampoRespostaContato(
        status,
        responseGroup
    );


    /* =====================================================
       ALTERAÇÃO
    ===================================================== */

    statusSelect.onchange =
        function() {

            const novoStatus =
                normalizarStatusContato(
                    this.value
                );


            atualizarCampoRespostaContato(
                novoStatus,
                responseGroup
            );

        };

}


/* =========================================================
   F9 — CAMPO DE RESPOSTA
   ========================================================= */

function atualizarCampoRespostaContato(
    status,
    responseGroup
) {

    if (!responseGroup) {
        return;
    }


    if (
        normalizarStatusContato(status) ===
        "RESPONDEU"
    ) {

        responseGroup.style.display =
            "block";

    } else {

        responseGroup.style.display =
            "none";

    }

}


/* =========================================================
   F9 — SALVAR ACOMPANHAMENTO
   ========================================================= */

async function saveContactFollowup() {

    if (!selectedId) {

        showMessage(
            "Nenhum participante selecionado."
        );

        return;
    }


    if (!db) {

        showMessage(
            "Supabase não está disponível."
        );

        return;
    }


    const statusSelect =
        document.getElementById(
            "contactStatus"
        );


    const responseField =
        document.getElementById(
            "clientResponse"
        );


    const button =
        document.getElementById(
            "saveContactFollowup"
        );


    if (
        !statusSelect ||
        !responseField ||
        !button
    ) {

        showMessage(
            "Campos do acompanhamento não encontrados."
        );

        return;

    }


    /* =====================================================
       STATUS
    ===================================================== */

    const status =
        normalizarStatusContato(
            statusSelect.value
        );


    /* =====================================================
       RESPOSTA
    ===================================================== */

    const resposta =
        responseField.value.trim();


    /* =====================================================
       VALIDAÇÃO
    ===================================================== */

    if (
        status === "RESPONDEU" &&
        !resposta
    ) {

        showMessage(
            "Digite a resposta do cliente."
        );


        responseField.focus();

        return;

    }


    button.disabled = true;

    button.textContent =
        "SALVANDO...";


    try {

        const agora =
            new Date().toISOString();


        /* =================================================
           SUPABASE
        ================================================= */

        const {
            error
        } = await db
            .from("inscricoes")
            .update({

                status_contato:
                    status,

                resposta_cliente:
                    status === "RESPONDEU"
                        ? resposta
                        : null,

                contato_atualizado_em:
                    agora

            })
            .eq(
                "id",
                selectedId
            );


        if (error) {
            throw error;
        }


        /* =================================================
           MEMÓRIA LOCAL
        ================================================= */

        const participant =
            allRows.find(
                row =>
                    String(row.id) ===
                    String(selectedId)
            );


        if (participant) {

            participant.status_contato =
                status;

            participant.resposta_cliente =
                status === "RESPONDEU"
                    ? resposta
                    : null;

            participant.contato_atualizado_em =
                agora;

        }


        /* =================================================
           ATUALIZAR TABELA
        ================================================= */

        render();


        /* =================================================
           ATUALIZAR F9
        ================================================= */

        configurarAcompanhamentoContato(
            participant || {

                status_contato:
                    status,

                resposta_cliente:
                    resposta

            }
        );


        showMessage(
            "Acompanhamento salvo com sucesso."
        );


    } catch (error) {

        console.error(
            "Erro ao salvar acompanhamento:",
            error
        );


        showMessage(
            "Erro ao salvar acompanhamento: " +
            (
                error?.message ||
                "Erro desconhecido."
            )
        );


    } finally {

        button.disabled = false;

        button.textContent =
            "SALVAR ACOMPANHAMENTO";

    }

}


/* =========================================================
   EXPORTAR CSV
   ========================================================= */

function exportCSV() {

    const rows =
        filtered();


    if (!rows.length) {

        showMessage(
            "Não existem inscrições para exportar."
        );

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

        ...rows.map(

            row =>
                columns
                    .map(
                        column =>
                            csvCell(
                                row[column]
                            )
                    )
                    .join(";")

        )

    ].join("\n");


    const blob =
        new Blob(

            [
                "\ufeff" +
                csv
            ],

            {
                type:
                    "text/csv;charset=utf-8"
            }

        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );


    link.href =
        url;


    link.download =
        "run-samba-inscricoes.csv";


    document.body.appendChild(
        link
    );


    link.click();


    link.remove();


    setTimeout(
        () => {

            URL.revokeObjectURL(
                url
            );

        },
        1000
    );


    showMessage(
        `${rows.length} ${
            rows.length === 1
                ? "inscrição exportada"
                : "inscrições exportadas"
        }.`
    );

}


/* =========================================================
   CSV CELL
   ========================================================= */

function csvCell(value) {

    return `"${String(
        value ?? ""
    ).replace(
        /"/g,
        '""'
    )}"`;

}


/* =========================================================
   CPF
   ========================================================= */

function formatCPF(cpf) {

    const value =
        String(cpf || "")
            .replace(
                /\D/g,
                ""
            );


    if (
        value.length !== 11
    ) {

        return cpf || "—";

    }


    return value.replace(
        /(\d{3})(\d{3})(\d{3})(\d{2})/,
        "$1.$2.$3-$4"
    );

}


/* =========================================================
   TELEFONE
   ========================================================= */

function formatPhone(phone) {

    const value =
        String(phone || "")
            .replace(
                /\D/g,
                ""
            );


    /* =====================================================
       DDI 55 + CELULAR
    ===================================================== */

    if (
        value.length === 13 &&
        value.startsWith("55")
    ) {

        const local =
            value.substring(2);


        return local.replace(
            /(\d{2})(\d{5})(\d{4})/,
            "($1) $2-$3"
        );

    }


    /* =====================================================
       DDI 55 + FIXO
    ===================================================== */

    if (
        value.length === 12 &&
        value.startsWith("55")
    ) {

        const local =
            value.substring(2);


        return local.replace(
            /(\d{2})(\d{4})(\d{4})/,
            "($1) $2-$3"
        );

    }


    /* =====================================================
       BRASIL — 11 DÍGITOS
    ===================================================== */

    if (
        value.length === 11
    ) {

        return value.replace(
            /(\d{2})(\d{5})(\d{4})/,
            "($1) $2-$3"
        );

    }


    /* =====================================================
       BRASIL — 10 DÍGITOS
    ===================================================== */

    if (
        value.length === 10
    ) {

        return value.replace(
            /(\d{2})(\d{4})(\d{4})/,
            "($1) $2-$3"
        );

    }


    return phone || "—";

}


/* =========================================================
   DATA
   ========================================================= */

function formatDate(date) {

    if (!date) {
        return "—";
    }


    const value =
        String(date);


    /* =====================================================
       YYYY-MM-DD
    ===================================================== */

    if (
        /^\d{4}-\d{2}-\d{2}$/.test(
            value
        )
    ) {

        const [
            year,
            month,
            day
        ] =
            value.split("-");


        return `${day}/${month}/${year}`;

    }


    /* =====================================================
       DATA ISO
    ===================================================== */

    if (
        value.includes("T")
    ) {

        const parsed =
            new Date(value);


        if (
            !Number.isNaN(
                parsed.getTime()
            )
        ) {

            return parsed.toLocaleDateString(
                "pt-BR"
            );

        }

    }


    return value;

}


/* =========================================================
   DINHEIRO
   ========================================================= */

function formatMoney(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return "—";

    }


    let number;


    if (
        typeof value === "number"
    ) {

        number =
            value;

    } else {

        let normalized =
            String(value)
                .trim()
                .replace(
                    /R\$\s?/gi,
                    ""
                )
                .replace(
                    /\s/g,
                    ""
                );


        if (
            normalized.includes(",")
        ) {

            number =
                Number(
                    normalized
                        .replace(
                            /\./g,
                            ""
                        )
                        .replace(
                            ",",
                            "."
                        )
                );

        } else {

            number =
                Number(
                    normalized
                );

        }

    }


    if (
        !Number.isFinite(
            number
        )
    ) {

        return String(value);

    }


    return number.toLocaleString(
        "pt-BR",
        {
            style: "currency",
            currency: "BRL"
        }
    );

}


/* =========================================================
   CLASSE PAGAMENTO
   ========================================================= */

function paymentClass(value) {

    const status =
        normalizarPagamento(
            value
        );


    if (
        status === "PAGO"
    ) {

        return "paid";

    }


    if (
        status === "CANCELADO"
    ) {

        return "cancelled";

    }


    return "pending";

}


/* =========================================================
   ESCAPAR HTML
   ========================================================= */

function esc(value) {

    const entities = {

        "&": "&amp;",

        "<": "&lt;",

        ">": "&gt;",

        '"': "&quot;",

        "'": "&#039;"

    };


    return String(
        value ?? ""
    ).replace(
        /[&<>"']/g,
        character =>
            entities[character]
    );

}


/* =========================================================
   MENSAGEM / TOAST
   ========================================================= */

function showMessage(text) {

    const el =
        document.getElementById(
            "message"
        );


    if (!el) {
        return;
    }


    el.textContent =
        text;


    el.classList.add(
        "show"
    );


    clearTimeout(
        showMessage.timer
    );


    showMessage.timer =
        setTimeout(
            () => {

                el.textContent =
                    "";

                el.classList.remove(
                    "show"
                );

            },
            5000
        );

}


/* =========================================================
   LOADING
   ========================================================= */

function setLoading(text) {

    const el =
        document.getElementById(
            "loading"
        );


    if (el) {

        el.textContent =
            text;

    }

}


/* =========================================================
   INICIAR
   ========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        init
    );

} else {

    init();

}
