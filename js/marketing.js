const db = window.supabaseClient;


// ========================================
// ESTADO DO CALENDÁRIO
// ========================================

let currentDate = new Date();

let contents = [];
let ideas = [];


// ========================================
// INICIAR
// ========================================

async function initMarketing() {

    try {

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


        if (!db) {

            showMessage(
                "Supabase não foi inicializado."
            );

            return;

        }


        bindEvents();

        await loadMarketing();


    } catch (error) {

        console.error(
            "Erro ao iniciar Marketing:",
            error
        );

        showMessage(
            "Erro ao iniciar marketing: " +
            error.message
        );

    }

}



// ========================================
// CARREGAR MARKETING
// ========================================

async function loadMarketing() {

    try {

        showLoading();


        // =================================
        // CONTEÚDOS
        // =================================

        const contentResult =
            await db
                .from("conteudos_marketing")
                .select("*")
                .order(
                    "data_publicacao",
                    {
                        ascending: true
                    }
                );


        if (contentResult.error) {

            console.error(
                "Erro conteúdos:",
                contentResult.error
            );

            throw contentResult.error;

        }


        contents =
            contentResult.data || [];


        // =================================
        // IDEIAS
        // =================================

        const ideasResult =
            await db
                .from("ideias_posts")
                .select("*")
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (ideasResult.error) {

            console.error(
                "Erro ideias:",
                ideasResult.error
            );

            throw ideasResult.error;

        }


        ideas =
            ideasResult.data || [];


        // =================================
        // RENDERIZAR
        // =================================

        updateSummary();

        renderCalendar();

        renderIdeas();

        hideMessage();


    } catch (error) {

        console.error(
            "Erro ao carregar marketing:",
            error
        );


        showMessage(
            "Erro ao carregar marketing: " +
            error.message
        );


    }

}



// ========================================
// RESUMO
// ========================================

function updateSummary() {

    const total =
        contents.length;


    const planned =
        contents.filter(
            item =>
                upper(item.status) ===
                "PLANEJADO"
        ).length;


    const published =
        contents.filter(
            item =>
                upper(item.status) ===
                "PUBLICADO"
        ).length;


    const month =
        contents.filter(
            item =>
                isCurrentMonth(
                    item.data_publicacao
                )
        ).length;


    setText(
        "totalContents",
        total
    );


    setText(
        "plannedContents",
        planned
    );


    setText(
        "publishedContents",
        published
    );


    setText(
        "monthContents",
        month
    );


    setText(
        "totalIdeas",
        ideas.length
    );

}



// ========================================
// CALENDÁRIO
// ========================================

function renderCalendar() {

    const grid =
        document.getElementById(
            "calendarGrid"
        );


    const title =
        document.getElementById(
            "calendarMonth"
        );


    if (!grid) {
        return;
    }


    const year =
        currentDate.getFullYear();


    const month =
        currentDate.getMonth();


    const monthName =
        currentDate.toLocaleDateString(
            "pt-BR",
            {
                month: "long",
                year: "numeric"
            }
        );


    if (title) {

        title.textContent =
            capitalize(monthName);

    }


    grid.innerHTML = "";


    const firstDay =
        new Date(
            year,
            month,
            1
        );


    const lastDay =
        new Date(
            year,
            month + 1,
            0
        );


    // Segunda-feira = 0
    let startDay =
        firstDay.getDay() - 1;


    if (startDay < 0) {
        startDay = 6;
    }


    const days =
        lastDay.getDate();


    // =================================
    // DIAS DO MÊS ANTERIOR
    // =================================

    const previousLastDay =
        new Date(
            year,
            month,
            0
        ).getDate();


    for (
        let i = startDay - 1;
        i >= 0;
        i--
    ) {

        const cell =
            createCalendarDay(
                previousLastDay - i,
                true
            );

        grid.appendChild(cell);

    }


    // =================================
    // DIAS DO MÊS
    // =================================

    for (
        let day = 1;
        day <= days;
        day++
    ) {

        const cell =
            createCalendarDay(
                day,
                false
            );

        grid.appendChild(cell);

    }


    // =================================
    // DIAS DO PRÓXIMO MÊS
    // =================================

    const totalCells =
        Math.ceil(
            grid.children.length / 7
        ) * 7;


    let nextDay = 1;


    while (
        grid.children.length <
        totalCells
    ) {

        const cell =
            createCalendarDay(
                nextDay,
                true
            );

        grid.appendChild(cell);

        nextDay++;

    }

}



// ========================================
// CRIAR DIA
// ========================================

function createCalendarDay(
    day,
    outside
) {

    const cell =
        document.createElement(
            "div"
        );


    cell.className =
        "calendar-day";


    if (outside) {

        cell.classList.add(
            "outside"
        );

    }


    const number =
        document.createElement(
            "div"
        );


    number.className =
        "calendar-day-number";


    number.textContent =
        day;


    cell.appendChild(
        number
    );


    if (outside) {
        return cell;
    }


    const year =
        currentDate.getFullYear();


    const month =
        currentDate.getMonth();


    const dateString =
        `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;


    const dayContents =
        contents.filter(
            item => {

                if (!item.data_publicacao) {
                    return false;
                }


                return String(
                    item.data_publicacao
                ).startsWith(
                    dateString
                );

            }
        );


    dayContents.forEach(
        content => {

            const item =
                document.createElement(
                    "div"
                );


            const status =
                upper(
                    content.status ||
                    "PLANEJADO"
                );


            item.className =
                "calendar-content";


            item.classList.add(
                getStatusClass(status)
            );


            item.innerHTML = `

                <strong>
                    ${esc(
                        content.titulo ||
                        "Conteúdo"
                    )}
                </strong>

                <span>
                    ${esc(
                        content.plataforma ||
                        "Sem plataforma"
                    )}
                </span>

            `;


            cell.appendChild(
                item
            );

        }
    );


    return cell;

}



// ========================================
// IDEIAS
// ========================================

function renderIdeas() {

    const grid =
        document.getElementById(
            "ideasGrid"
        );


    if (!grid) {
        return;
    }


    if (!ideas.length) {

        grid.innerHTML = `

            <div class="content-empty">

                <div class="empty-icon">
                    ✦
                </div>

                <h3>
                    Nenhuma ideia cadastrada
                </h3>

                <p>
                    A equipe ainda não registrou
                    nenhuma ideia de post.
                </p>

                <button
                    type="button"
                    class="primary-small-btn"
                    onclick="openIdeaModal()"
                >
                    + REGISTRAR IDEIA
                </button>

            </div>

        `;

        return;

    }


    grid.innerHTML =
        ideas.map(
            idea => {

                const priority =
                    upper(
                        idea.prioridade ||
                        "NORMAL"
                    );


                const status =
                    upper(
                        idea.status ||
                        "NOVA"
                    );


                return `

                    <article class="idea-card">

                        <div class="idea-card-head">

                            <span class="idea-status">
                                ${esc(status)}
                            </span>

                            <span
                                class="idea-priority ${priority.toLowerCase()}"
                            >
                                ${esc(priority)}
                            </span>

                        </div>


                        <h3>
                            ${esc(
                                idea.titulo ||
                                "Ideia sem título"
                            )}
                        </h3>


                        <p>
                            ${esc(
                                idea.descricao ||
                                "Sem descrição."
                            )}
                        </p>


                        <div class="idea-meta">

                            <span>
                                📱
                                ${esc(
                                    idea.plataforma ||
                                    "Não definido"
                                )}
                            </span>


                            <span>
                                🎬
                                ${esc(
                                    idea.formato ||
                                    "Não definido"
                                )}
                            </span>

                        </div>


                        <div class="idea-footer">

                            <span>
                                ${esc(
                                    idea.autor ||
                                    "Equipe"
                                )}
                            </span>


                            <span>
                                ${formatDate(
                                    idea.created_at
                                )}
                            </span>

                        </div>

                    </article>

                `;

            }
        ).join("");

}



// ========================================
// EVENTOS
// ========================================

function bindEvents() {


    // =================================
    // ATUALIZAR
    // =================================

    const refresh =
        document.getElementById(
            "refreshMarketing"
        );


    if (refresh) {

        refresh.addEventListener(
            "click",
            loadMarketing
        );

    }


    // =================================
    // NOVO CONTEÚDO
    // =================================

    const newContent =
        document.getElementById(
            "newContentBtn"
        );


    if (newContent) {

        newContent.addEventListener(
            "click",
            openContentModal
        );

    }


    // =================================
    // NOVA IDEIA
    // =================================

    const newIdea =
        document.getElementById(
            "newIdeaBtn"
        );


    if (newIdea) {

        newIdea.addEventListener(
            "click",
            openIdeaModal
        );

    }


    const newIdeaPanel =
        document.getElementById(
            "newIdeaBtnPanel"
        );


    if (newIdeaPanel) {

        newIdeaPanel.addEventListener(
            "click",
            openIdeaModal
        );

    }


    // =================================
    // FECHAR CONTEÚDO
    // =================================

    const closeContent =
        document.getElementById(
            "closeContentModal"
        );


    if (closeContent) {

        closeContent.addEventListener(
            "click",
            closeContentModal
        );

    }


    // =================================
    // FECHAR IDEIA
    // =================================

    const closeIdea =
        document.getElementById(
            "closeIdeaModal"
        );


    if (closeIdea) {

        closeIdea.addEventListener(
            "click",
            closeIdeaModal
        );

    }


    // =================================
    // MÊS ANTERIOR
    // =================================

    const prev =
        document.getElementById(
            "prevMonth"
        );


    if (prev) {

        prev.addEventListener(
            "click",
            () => {

                currentDate.setMonth(
                    currentDate.getMonth() - 1
                );

                renderCalendar();

            }
        );

    }


    // =================================
    // PRÓXIMO MÊS
    // =================================

    const next =
        document.getElementById(
            "nextMonth"
        );


    if (next) {

        next.addEventListener(
            "click",
            () => {

                currentDate.setMonth(
                    currentDate.getMonth() + 1
                );

                renderCalendar();

            }
        );

    }


    // =================================
    // FORMULÁRIO CONTEÚDO
    // =================================

    const contentForm =
        document.getElementById(
            "contentForm"
        );


    if (contentForm) {

        contentForm.addEventListener(
            "submit",
            saveContent
        );

    }


    // =================================
    // FORMULÁRIO IDEIA
    // =================================

    const ideaForm =
        document.getElementById(
            "ideaForm"
        );


    if (ideaForm) {

        ideaForm.addEventListener(
            "submit",
            saveIdea
        );

    }

}



// ========================================
// MODAL CONTEÚDO
// ========================================

function openContentModal() {

    const modal =
        document.getElementById(
            "contentModal"
        );


    if (modal) {

        modal.classList.remove(
            "hidden"
        );

    }

}


function closeContentModal() {

    const modal =
        document.getElementById(
            "contentModal"
        );


    if (modal) {

        modal.classList.add(
            "hidden"
        );

    }

}



// ========================================
// MODAL IDEIA
// ========================================

function openIdeaModal() {

    const modal =
        document.getElementById(
            "ideaModal"
        );


    if (modal) {

        modal.classList.remove(
            "hidden"
        );

    }

}


function closeIdeaModal() {

    const modal =
        document.getElementById(
            "ideaModal"
        );


    if (modal) {

        modal.classList.add(
            "hidden"
        );

    }

}



// ========================================
// SALVAR IDEIA
// ========================================

async function saveIdea(event) {

    event.preventDefault();


    const button =
        event.target.querySelector(
            "button[type='submit']"
        );


    if (button) {

        button.disabled = true;

        button.textContent =
            "SALVANDO...";

    }


    try {

        const idea = {

            titulo:
                document.getElementById(
                    "ideaTitle"
                ).value.trim(),

            descricao:
                document.getElementById(
                    "ideaDescription"
                ).value.trim(),

            plataforma:
                document.getElementById(
                    "ideaPlatform"
                ).value,

            formato:
                document.getElementById(
                    "ideaFormat"
                ).value,

            prioridade:
                document.getElementById(
                    "ideaPriority"
                ).value,

            autor:
                document.getElementById(
                    "ideaAuthor"
                ).value.trim(),

            status:
                "NOVA"

        };


        const {
            error
        } = await db
            .from("ideias_posts")
            .insert(
                idea
            );


        if (error) {

            throw error;

        }


        event.target.reset();

        closeIdeaModal();


        showMessage(
            "Ideia cadastrada com sucesso."
        );


        await loadMarketing();


    } catch (error) {

        console.error(
            "Erro ao salvar ideia:",
            error
        );


        showMessage(
            "Erro ao salvar ideia: " +
            error.message
        );


    } finally {

        if (button) {

            button.disabled = false;

            button.textContent =
                "SALVAR IDEIA";

        }

    }

}



// ========================================
// SALVAR CONTEÚDO
// ========================================

async function saveContent(event) {

    event.preventDefault();


    const button =
        event.target.querySelector(
            "button[type='submit']"
        );


    if (button) {

        button.disabled = true;

        button.textContent =
            "SALVANDO...";

    }


    try {

        const dateValue =
            document.getElementById(
                "contentDate"
            ).value;


        const content = {

            titulo:
                document.getElementById(
                    "contentTitle"
                ).value.trim(),

            plataforma:
                document.getElementById(
                    "contentPlatform"
                ).value,

            formato:
                document.getElementById(
                    "contentFormat"
                ).value,

            data_publicacao:
                dateValue,

            status:
                document.getElementById(
                    "contentStatus"
                ).value,

            legenda:
                document.getElementById(
                    "contentCaption"
                ).value.trim(),

            imagem_url:
                document.getElementById(
                    "contentImage"
                ).value.trim()

        };


        const {
            error
        } = await db
            .from("conteudos_marketing")
            .insert(
                content
            );


        if (error) {

            throw error;

        }


        event.target.reset();

        closeContentModal();


        showMessage(
            "Conteúdo cadastrado com sucesso."
        );


        await loadMarketing();


    } catch (error) {

        console.error(
            "Erro ao salvar conteúdo:",
            error
        );


        showMessage(
            "Erro ao salvar conteúdo: " +
            error.message
        );


    } finally {

        if (button) {

            button.disabled = false;

            button.textContent =
                "SALVAR CONTEÚDO";

        }

    }

}



// ========================================
// STATUS
// ========================================

function getStatusClass(status) {

    switch (status) {

        case "PUBLICADO":
            return "published";

        case "AGENDADO":
            return "scheduled";

        case "RASCUNHO":
            return "draft";

        default:
            return "planned";

    }

}



// ========================================
// UTILITÁRIOS
// ========================================

function upper(value) {

    return String(
        value ?? ""
    )
        .trim()
        .toUpperCase();

}


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


function formatDate(value) {

    if (!value) {
        return "—";
    }


    const date =
        new Date(value);


    if (isNaN(date)) {
        return "—";
    }


    return date.toLocaleDateString(
        "pt-BR"
    );

}


function isCurrentMonth(value) {

    if (!value) {
        return false;
    }


    const date =
        new Date(value);


    if (isNaN(date)) {
        return false;
    }


    return (
        date.getMonth() ===
        currentDate.getMonth()
        &&
        date.getFullYear() ===
        currentDate.getFullYear()
    );

}


function capitalize(value) {

    return value.charAt(0).toUpperCase() +
        value.slice(1);

}


function esc(value) {

    return String(
        value ?? ""
    ).replace(
        /[&<>"']/g,
        character =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            }[character])
    );

}



// ========================================
// MENSAGEM
// ========================================

function showMessage(text) {

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


function showLoading() {

    const grid =
        document.getElementById(
            "ideasGrid"
        );


    if (grid) {

        grid.innerHTML = `

            <div class="content-loading">
                Carregando ideias...
            </div>

        `;

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
        initMarketing
    );

} else {

    initMarketing();

}