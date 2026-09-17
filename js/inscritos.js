/* =========================================================
   RUN & SAMBA 2026
   CRM — INSCRITOS
   PARTICIPANTES + PAGAMENTO + COMUNICAÇÃO
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
           CARREGAR DADOS
        ===================================================== */

        await loadRows();


        /* =====================================================
           EVENTOS
        ===================================================== */

        bindEvents();


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

    setLoading(
        "Carregando inscrições..."
    );


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

        console.error(
            "Erro Supabase:",
            error
        );


        showMessage(
            "Erro ao carregar inscrições: " +
            error.message
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
                            ${esc(error.message)}
                        </small>

                    </td>

                </tr>

            `;

        }


        setLoading("");

        return;
    }


    allRows =
        Array.isArray(data)
            ? data
            : [];


    render();


    setLoading("");

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

    const saveBtn =
        document.getElementById(
            "savePayment"
        );


    if (saveBtn) {

        saveBtn.addEventListener(
            "click",
            savePayment
        );

    }


    /* =====================================================
       ESC
       ===================================================== */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

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

                logoutBtn.textContent =
                    "SAINDO...";


                try {

                    await window.crmAuth.logout();

                } catch (error) {

                    console.error(
                        "Erro ao sair:",
                        error
                    );

                    logoutBtn.disabled =
                        false;

                    logoutBtn.textContent =
                        "SAIR";

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
            .map(value =>
                String(
                    value ?? ""
                )
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

            (
                !q ||
                text.includes(q)
            )

            &&

            (
                !payment ||
                statusPagamento === payment
            )

            &&

            (
                !route ||
                percurso === route
            )

            &&

            (
                !shirt ||
                camiseta === shirt
            )

        );

    });

}


/* =========================================================
   NORMALIZAR PAGAMENTO
   ========================================================= */

function normalizarPagamento(value) {

    const status =
        String(
            value ?? ""
        )
            .trim()
            .toUpperCase();


    if (
        status === "PAGO"
    ) {

        return "PAGO";

    }


    if (
        status === "CANCELADO"
    ) {

        return "CANCELADO";

    }


    return "PENDENTE";

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

                        <td>

                            <strong>
                                ${esc(
                                    row.nome ||
                                    "—"
                                )}
                            </strong>

                            ${
                                row.email
                                    ? `
                                        <small>
                                            ${esc(
                                                row.email
                                            )}
                                        </small>
                                      `
                                    : ""
                            }

                        </td>


                        <!-- CPF -->

                        <td>

                            ${esc(
                                formatCPF(
                                    row.cpf
                                )
                            )}

                        </td>


                        <!-- TELEFONE -->

                        <td>

                            ${esc(
                                formatPhone(
                                    row.telefone
                                )
                            )}

                        </td>


                        <!-- PERCURSO -->

                        <td>

                            ${esc(
                                row.percurso ||
                                "—"
                            )}

                        </td>


                        <!-- CAMISETA -->

                        <td>

                            ${esc(
                                row.camiseta ||
                                "—"
                            )}

                        </td>


                        <!-- PAGAMENTO -->

                        <td>

                            <span
                                class="status-badge ${paymentClass(
                                    pagamento
                                )}"
                            >

                                ${esc(
                                    pagamento
                                )}

                            </span>

                        </td>


                        <!-- AÇÕES -->

                        <td>

                            <button
                                type="button"
                                class="action-btn"
                                data-id="${esc(
                                    row.id
                                )}"
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
        .querySelectorAll(
            ".action-btn"
        )
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
       DADOS
       ===================================================== */

    const fields = [

        [
            "CPF",
            formatCPF(
                participant.cpf
            )
        ],

        [
            "Nascimento",
            formatDate(
                participant.nascimento
            )
        ],

        [
            "E-mail",
            participant.email
        ],

        [
            "Telefone",
            formatPhone(
                participant.telefone
            )
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
            formatMoney(
                participant.valor
            )
        ],

        [
            "Status",
            participant.status
        ],

        [
            "Pagamento",
            pagamento
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
       ABRIR
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


    /* =====================================================
       STATUS
       ===================================================== */

    const pagamento =
        normalizarPagamento(
            participante.status_pagamento
        );


    /* =====================================================
       SÓ PENDENTE
       ===================================================== */

    if (
        pagamento !== "PENDENTE"
    ) {

        communicationBox.classList.add(
            "hidden"
        );


        whatsappBtn.removeAttribute(
            "href"
        );


        emailBtn.removeAttribute(
            "href"
        );


        whatsappBtn.onclick =
            null;


        emailBtn.onclick =
            null;


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


    whatsappBtn.onclick =
        null;


    whatsappBtn.removeAttribute(
        "href"
    );


    if (numero) {

        whatsappBtn.href =
            "https://wa.me/" +
            numero +
            "?text=" +
            encodeURIComponent(
                mensagem
            );


        whatsappBtn.target =
            "_blank";


        whatsappBtn.rel =
            "noopener noreferrer";


        whatsappBtn.style.display =
            "inline-flex";

    } else {

        whatsappBtn.style.display =
            "inline-flex";


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

    emailBtn.onclick =
        null;


    emailBtn.removeAttribute(
        "href"
    );


    if (email) {

        const assunto =
            criarAssuntoEmail();


        emailBtn.href =
            "mailto:" +
            encodeURIComponent(
                email
            ) +
            "?subject=" +
            encodeURIComponent(
                assunto
            ) +
            "&body=" +
            encodeURIComponent(
                mensagem
            );


        emailBtn.style.display =
            "inline-flex";

    } else {

        emailBtn.style.display =
            "inline-flex";


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
   MENSAGEM PAGAMENTO PENDENTE
   ========================================================= */

function criarMensagemPagamento(
    nome
) {

    const primeiroNome =
        String(
            nome ||
            "participante"
        )
            .trim()
            .split(/\s+/)[0];


    return `Olá, ${primeiroNome}! Tudo bem?

Vi que você fez sua inscrição na Run & Samba 2ª edição, mas o pagamento ainda não foi concluído.

Passando para avisar que o segundo lote estará disponível em breve.

Se você ainda quiser participar, fique de olho para garantir sua inscrição antes da abertura do próximo lote.

Se precisar de ajuda com a inscrição ou pagamento, estamos à disposição. 🏃🏽‍♀️🎶

Run & Samba 2026
CORRA. SINTA. VIVA.`;

}


/* =========================================================
   ASSUNTO E-MAIL
   ========================================================= */

function criarAssuntoEmail() {

    return (
        "Run & Samba 2026 — segundo lote em breve"
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


    btn.disabled =
        true;


    btn.textContent =
        "SALVANDO...";


    try {

        const {
            error
        } = await db
            .from("inscricoes")
            .update({

                status_pagamento:
                    value,

                updated_at:
                    new Date().toISOString()

            })
            .eq(
                "id",
                selectedId
            );


        if (error) {

            throw error;

        }


        /* =================================================
           ATUALIZAR MEMÓRIA LOCAL
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

        }


        /* =================================================
           ATUALIZAR TABELA
           ================================================= */

        render();


        /* =================================================
           FECHAR MODAL
           ================================================= */

        closeModal();


        /* =================================================
           MENSAGEM
           ================================================= */

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

        btn.disabled =
            false;


        btn.textContent =
            "SALVAR PAGAMENTO";

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
        String(
            cpf || ""
        )
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
        String(
            phone || ""
        )
            .replace(
                /\D/g,
                ""
            );


    /* =====================================================
       DDI 55
       ===================================================== */

    if (
        value.length === 13 &&
        value.startsWith("55")
    ) {

        const local =
            value.substring(2);


        if (
            local.length === 11
        ) {

            return local.replace(
                /(\d{2})(\d{5})(\d{4})/,
                "($1) $2-$3"
            );

        }


        if (
            local.length === 10
        ) {

            return local.replace(
                /(\d{2})(\d{4})(\d{4})/,
                "($1) $2-$3"
            );

        }

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


        return (
            `${day}/${month}/${year}`
        );

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

        const normalized =
            String(value)
                .trim()
                .replace(
                    /R\$/gi,
                    ""
                )
                .replace(
                    /\s/g,
                    ""
                );


        /*
         * Trata valores como:
         *
         * 89,90
         * 89.90
         */

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

        return String(
            value
        );

    }


    return number.toLocaleString(
        "pt-BR",
        {
            style:
                "currency",

            currency:
                "BRL"
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

    return String(
        value ?? ""
    )
        .replace(
            /[&<>"']/g,
            character => {

                const entities = {

                    "&":
                        "&amp;",

                    "<":
                        "&lt;",

                    ">":
                        "&gt;",

                    '"':
                        "&quot;",

                    "'":
                        "&#039;"

                };


                return entities[
                    character
                ];

            }
        );

}


/* =========================================================
   MENSAGEM
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