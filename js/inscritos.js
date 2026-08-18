const db = window.supabaseClient;

let allRows = [];
let selectedId = null;


// ========================================
// INICIALIZAÇÃO
// ========================================

async function init() {

    try {

        if (!db) {

            showMessage(
                "Supabase não foi inicializado. Verifique o config.js."
            );

            return;
        }


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


        await loadRows();

        bindEvents();


    } catch (error) {

        console.error(
            "Erro na inicialização do CRM:",
            error
        );

        showMessage(
            "Erro ao iniciar o CRM: " +
            error.message
        );

    }

}


// ========================================
// CARREGAR INSCRIÇÕES
// ========================================

async function loadRows() {

    setLoading("Carregando...");


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


        document.getElementById(
            "tableBody"
        ).innerHTML = `

            <tr>

                <td colspan="7">

                    Erro ao carregar inscrições.

                    <br>

                    <small>
                        ${esc(error.message)}
                    </small>

                </td>

            </tr>

        `;


        setLoading("");

        return;
    }


    allRows = data || [];


    render();


    setLoading("");

}


// ========================================
// EVENTOS
// ========================================

function bindEvents() {


    [
        "search",
        "paymentFilter",
        "routeFilter",
        "shirtFilter"
    ].forEach(id => {

        const el =
            document.getElementById(id);


        if (!el) {
            return;
        }


        el.addEventListener(
            "input",
            render
        );


        el.addEventListener(
            "change",
            render
        );

    });


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


    const modal =
        document.getElementById(
            "editModal"
        );


    if (modal) {

        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target.id ===
                    "editModal"
                ) {

                    closeModal();

                }

            }
        );

    }


    const logoutBtn =
        document.getElementById(
            "logoutBtn"
        );


    if (
        logoutBtn &&
        window.crmAuth &&
        typeof window.crmAuth.logout ===
        "function"
    ) {

        logoutBtn.addEventListener(
            "click",
            async () => {

                await window.crmAuth.logout();

            }
        );

    }

}


// ========================================
// FILTRAR
// ========================================

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
        .toUpperCase();


    const route =
        String(
            routeElement?.value || ""
        )
        .toUpperCase();


    const shirt =
        String(
            shirtElement?.value || ""
        )
        .toUpperCase();


    return allRows.filter(r => {


        const text = [

            r.nome,

            r.cpf,

            r.email,

            r.telefone

        ]
            .map(v => String(v || ""))
            .join(" ")
            .toLowerCase();


        const statusPagamento =
            String(
                r.status_pagamento ||
                "PENDENTE"
            )
            .toUpperCase();


        const percurso =
            String(
                r.percurso || ""
            )
            .toUpperCase();


        const camiseta =
            String(
                r.camiseta || ""
            )
            .toUpperCase();


        return (

            (!q || text.includes(q))

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


// ========================================
// RENDERIZAR TABELA
// ========================================

function render() {


    const rows =
        filtered();


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


    const body =
        document.getElementById(
            "tableBody"
        );


    if (!body) {
        return;
    }


    if (!rows.length) {

        body.innerHTML = `

            <tr>

                <td colspan="7">

                    Nenhum participante encontrado.

                </td>

            </tr>

        `;

        return;

    }


    body.innerHTML =
        rows.map(r => {


            const pagamento =
                String(
                    r.status_pagamento ||
                    "PENDENTE"
                ).toUpperCase();


            return `

                <tr>

                    <td>

                        <strong>
                            ${esc(
                                r.nome || "—"
                            )}
                        </strong>

                        ${
                            r.email
                                ? `
                                    <small>
                                        ${esc(
                                            r.email
                                        )}
                                    </small>
                                  `
                                : ""
                        }

                    </td>


                    <td>
                        ${esc(
                            formatCPF(r.cpf)
                        )}
                    </td>


                    <td>
                        ${esc(
                            formatPhone(
                                r.telefone
                            )
                        )}
                    </td>


                    <td>
                        ${esc(
                            r.percurso || "—"
                        )}
                    </td>


                    <td>
                        ${esc(
                            r.camiseta || "—"
                        )}
                    </td>


                    <td>

                        <span
                            class="badge ${paymentClass(
                                pagamento
                            )}"
                        >

                            ${esc(
                                pagamento
                            )}

                        </span>

                    </td>


                    <td>

                        <button
                            type="button"
                            class="action-btn"
                            data-id="${esc(
                                r.id
                            )}"
                        >

                            VER

                        </button>

                    </td>

                </tr>

            `;

        }).join("");


    body
        .querySelectorAll(
            ".action-btn"
        )
        .forEach(btn => {

            btn.addEventListener(
                "click",
                () => {

                    openModal(
                        btn.dataset.id
                    );

                }
            );

        });

}


// ========================================
// ABRIR MODAL
// ========================================

function openModal(id) {


    const r =
        allRows.find(
            x =>
                String(x.id) ===
                String(id)
        );


    if (!r) {
        return;
    }


    selectedId = r.id;


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


    if (modalName) {

        modalName.textContent =
            r.nome ||
            "Participante";

    }


    if (modalPayment) {

        modalPayment.value =
            String(
                r.status_pagamento ||
                "PENDENTE"
            ).toUpperCase();

    }


    const fields = [

        [
            "CPF",
            formatCPF(r.cpf)
        ],

        [
            "Nascimento",
            formatDate(r.nascimento)
        ],

        [
            "E-mail",
            r.email
        ],

        [
            "Telefone",
            formatPhone(r.telefone)
        ],

        [
            "Sexo",
            r.sexo
        ],

        [
            "Camiseta",
            r.camiseta
        ],

        [
            "Percurso",
            r.percurso
        ],

        [
            "Valor",
            formatMoney(r.valor)
        ],

        [
            "Status",
            r.status
        ],

        [
            "Pagamento",
            r.status_pagamento ||
            "PENDENTE"
        ]

    ];


    if (modalData) {

        modalData.innerHTML =
            fields.map(
                ([label, value]) => `

                    <div>

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
            ).join("");

    }


    // ==========================
    // WHATSAPP
    // ==========================

    const whatsappBtn =
        document.getElementById(
            "whatsappBtn"
        );


    const phone =
        String(
            r.telefone || ""
        ).replace(
            /\D/g,
            ""
        );


    const message =
        encodeURIComponent(
            `Olá, ${r.nome || ""}! ` +
            `Aqui é da organização Run & Samba.`
        );


    if (whatsappBtn) {

        if (phone) {

            whatsappBtn.href =
                `https://wa.me/55${phone}?text=${message}`;

            whatsappBtn.style.display =
                "inline-flex";

        } else {

            whatsappBtn.href =
                "#";

            whatsappBtn.style.display =
                "none";

        }

    }


    modal.classList.remove(
        "hidden"
    );

}


// ========================================
// FECHAR MODAL
// ========================================

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


    selectedId = null;

}


// ========================================
// SALVAR PAGAMENTO
// ========================================

async function savePayment() {


    if (!selectedId) {
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
        String(
            select.value
        ).toUpperCase();


    btn.disabled = true;

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


        const item =
            allRows.find(
                x =>
                    String(x.id) ===
                    String(selectedId)
            );


        if (item) {

            item.status_pagamento =
                value;

        }


        render();

        closeModal();


        showMessage(
            "Pagamento atualizado com sucesso."
        );


    } catch (error) {


        console.error(
            "Erro ao atualizar:",
            error
        );


        showMessage(
            "Erro ao atualizar pagamento: " +
            error.message
        );


    } finally {

        btn.disabled = false;

        btn.textContent =
            "SALVAR PAGAMENTO";

    }

}


// ========================================
// EXPORTAR CSV
// ========================================

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
            r =>
                columns
                    .map(
                        c =>
                            csvCell(
                                r[c]
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


    const a =
        document.createElement(
            "a"
        );


    a.href = url;

    a.download =
        "run-samba-inscricoes.csv";


    document.body.appendChild(a);

    a.click();

    a.remove();


    setTimeout(
        () => {
            URL.revokeObjectURL(
                url
            );
        },
        1000
    );

}


// ========================================
// CSV
// ========================================

function csvCell(value) {

    return `"${String(
        value ?? ""
    ).replace(
        /"/g,
        '""'
    )}"`;

}


// ========================================
// CPF
// ========================================

function formatCPF(cpf) {

    const value =
        String(
            cpf || ""
        ).replace(
            /\D/g,
            ""
        );


    if (value.length !== 11) {

        return cpf || "—";

    }


    return value.replace(
        /(\d{3})(\d{3})(\d{3})(\d{2})/,
        "$1.$2.$3-$4"
    );

}


// ========================================
// TELEFONE
// ========================================

function formatPhone(phone) {

    const value =
        String(
            phone || ""
        ).replace(
            /\D/g,
            ""
        );


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


// ========================================
// DATA
// ========================================

function formatDate(date) {

    if (!date) {
        return "—";
    }


    const value =
        String(date);


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


    return value;

}


// ========================================
// DINHEIRO
// ========================================

function formatMoney(value) {


    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return "—";

    }


    const number =
        Number(
            String(value)
                .replace(",", ".")
        );


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


// ========================================
// CLASSE PAGAMENTO
// ========================================

function paymentClass(value) {


    const status =
        String(
            value ||
            "PENDENTE"
        ).toUpperCase();


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


// ========================================
// ESCAPAR HTML
// ========================================

function esc(value) {

    return String(
        value ?? ""
    ).replace(
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


// ========================================
// MENSAGEM
// ========================================

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


    setTimeout(
        () => {

            el.textContent =
                "";

        },
        4000
    );

}


// ========================================
// LOADING
// ========================================

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


// ========================================
// INICIAR
// ========================================

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