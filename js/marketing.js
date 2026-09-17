"use strict";

/* =========================================================
   SUPABASE
========================================================= */

const db = window.supabaseClient;

/* =========================================================
   ESTADO
========================================================= */

let currentDate = new Date();

let contents = [];
let ideas = [];
let tasks = [];

let currentEditingContent = null;
let currentViewingContent = null;
let currentEditingTask = null;

let activeIdeaFilter = "todos";
let activeCalendarView = "month";

/* =========================================================
   INICIALIZAÇÃO
========================================================= */

async function initMarketing() {
    try {
        if (
            !window.crmAuth ||
            typeof window.crmAuth.requireAuth !== "function"
        ) {
            showMessage("Sistema de autenticação não encontrado.");
            return;
        }

        const session = await window.crmAuth.requireAuth();

        if (!session) {
            return;
        }

        if (!db) {
            showMessage("Supabase não foi inicializado.");
            return;
        }

        bindEvents();
        await loadMarketing();

    } catch (error) {
        console.error("Erro ao iniciar Marketing:", error);

        showMessage(
            "Erro ao iniciar marketing: " +
            getErrorMessage(error)
        );
    }
}

/* =========================================================
   CARREGAR DADOS
========================================================= */

async function loadMarketing() {
    try {
        showLoading();

        /* =====================================================
           CONTEÚDOS
        ===================================================== */

        const contentResult = await db
            .from("conteudos_marketing")
            .select("*")
            .order("data_publicacao", {
                ascending: true
            });

        if (contentResult.error) {
            console.error(
                "Erro conteúdos:",
                contentResult.error
            );

            throw contentResult.error;
        }

        contents = contentResult.data || [];

        /* =====================================================
           IDEIAS
        ===================================================== */

        const ideasResult = await db
            .from("ideias_posts")
            .select("*")
            .order("created_at", {
                ascending: false
            });

        if (ideasResult.error) {
            console.error(
                "Erro ideias:",
                ideasResult.error
            );

            throw ideasResult.error;
        }

        ideas = ideasResult.data || [];

        /* =====================================================
           TAREFAS
        ===================================================== */

        const tasksResult = await db
            .from("tarefas_marketing")
            .select("*")
            .order("data_tarefa", {
                ascending: true
            });

        if (tasksResult.error) {
            console.warn(
                "Tabela tarefas_marketing não disponível:",
                tasksResult.error.message
            );

            tasks = [];
        } else {
            tasks = tasksResult.data || [];
        }

        populateResponsibleFilter();

        updateSummary();
        renderCalendar();
        renderUpcoming();
        renderIdeas();

        hideMessage();

    } catch (error) {
        console.error(
            "Erro ao carregar marketing:",
            error
        );

        showMessage(
            "Erro ao carregar marketing: " +
            getErrorMessage(error)
        );
    }
}

/* =========================================================
   RESUMO
========================================================= */

function updateSummary() {
    const today = new Date();

    const startToday = startOfDay(today);
    const endToday = endOfDay(today);

    const nextWeek = new Date(today);

    nextWeek.setDate(
        nextWeek.getDate() + 7
    );

    const todayCount = contents.filter(item => {
        const date = parseDate(item.data_publicacao);

        return (
            date &&
            date >= startToday &&
            date <= endToday
        );
    }).length;

    const weekCount = contents.filter(item => {
        const date = parseDate(item.data_publicacao);

        return (
            date &&
            date >= startToday &&
            date <= nextWeek
        );
    }).length;

    const pendingTaskCount = tasks.filter(task => {
        const status = upper(task.status);

        return (
            status !== "CONCLUIDA" &&
            status !== "CONCLUÍDA"
        );
    }).length;

    const publishedCount = contents.filter(item =>
        upper(item.status) === "PUBLICADO"
    ).length;

    setText("todayContents", todayCount);
    setText("weekContents", weekCount);
    setText("pendingTasks", pendingTaskCount);
    setText("publishedContents", publishedCount);
    setText("totalIdeas", ideas.length);

    setText("totalContents", contents.length);

    setText(
        "plannedContents",
        contents.filter(item =>
            upper(item.status) === "PLANEJADO"
        ).length
    );

    setText(
        "monthContents",
        contents.filter(item =>
            isCurrentMonth(item.data_publicacao)
        ).length
    );
}

/* =========================================================
   FILTROS
========================================================= */

function getFilteredContents() {
    const type = upper(
        getValue("contentTypeFilter")
    );

    const status = upper(
        getValue("contentStatusFilter")
    );

    const responsible = getValue(
        "contentResponsibleFilter"
    );

    return contents.filter(content => {
        const contentType = upper(
            content.tipo ||
            content.type ||
            content.formato ||
            ""
        );

        const contentStatus = upper(
            content.status || ""
        );

        const contentResponsible = String(
            content.responsavel || ""
        ).trim();

        const typeOK =
            type === "TODOS" ||
            type === "" ||
            contentType === type;

        const statusOK =
            status === "TODOS" ||
            status === "" ||
            contentStatus === status;

        const responsibleOK =
            responsible === "todos" ||
            responsible === "" ||
            contentResponsible === responsible;

        return (
            typeOK &&
            statusOK &&
            responsibleOK
        );
    });
}

/* =========================================================
   RESPONSÁVEIS
========================================================= */

function populateResponsibleFilter() {
    const select = document.getElementById(
        "contentResponsibleFilter"
    );

    if (!select) {
        return;
    }

    const currentValue = select.value;

    const names = new Set();

    contents.forEach(item => {
        if (
            item.responsavel &&
            String(item.responsavel).trim()
        ) {
            names.add(
                String(item.responsavel).trim()
            );
        }
    });

    tasks.forEach(item => {
        if (
            item.responsavel &&
            String(item.responsavel).trim()
        ) {
            names.add(
                String(item.responsavel).trim()
            );
        }
    });

    const sortedNames = [...names].sort(
        (a, b) =>
            a.localeCompare(
                b,
                "pt-BR"
            )
    );

    select.innerHTML =
        `<option value="todos">Todos os responsáveis</option>`;

    sortedNames.forEach(name => {
        const option =
            document.createElement("option");

        option.value = name;
        option.textContent = name;

        select.appendChild(option);
    });

    if (
        sortedNames.includes(currentValue)
    ) {
        select.value = currentValue;
    } else {
        select.value = "todos";
    }
}

/* =========================================================
   CALENDÁRIO
========================================================= */

function renderCalendar() {
    if (activeCalendarView === "week") {
        renderWeekCalendar();
        return;
    }

    if (activeCalendarView === "agenda") {
        renderAgenda();
        return;
    }

    renderMonthCalendar();
}

/* =========================================================
   CALENDÁRIO MENSAL
========================================================= */

function renderMonthCalendar() {
    const grid = document.getElementById(
        "calendarGrid"
    );

    const title = document.getElementById(
        "calendarMonth"
    );

    if (!grid) {
        return;
    }

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

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

    const firstDay = new Date(
        year,
        month,
        1
    );

    const lastDay = new Date(
        year,
        month + 1,
        0
    );

    let startDay =
        firstDay.getDay() - 1;

    if (startDay < 0) {
        startDay = 6;
    }

    const days = lastDay.getDate();

    const previousLastDay =
        new Date(
            year,
            month,
            0
        ).getDate();

    /* Dias anteriores */

    for (
        let i = startDay - 1;
        i >= 0;
        i--
    ) {
        const cell = createCalendarDay(
            previousLastDay - i,
            true,
            -1
        );

        grid.appendChild(cell);
    }

    /* Dias atuais */

    for (
        let day = 1;
        day <= days;
        day++
    ) {
        const cell = createCalendarDay(
            day,
            false,
            0
        );

        grid.appendChild(cell);
    }

    /* Dias posteriores */

    while (
        grid.children.length % 7 !== 0
    ) {
        const nextDay =
            grid.children.length -
            (startDay + days) +
            1;

        const cell = createCalendarDay(
            nextDay,
            true,
            1
        );

        grid.appendChild(cell);
    }
}

/* =========================================================
   CRIAR DIA
========================================================= */

function createCalendarDay(
    day,
    outside,
    offset
) {
    const cell =
        document.createElement("div");

    cell.className = "calendar-day";

    if (outside) {
        cell.classList.add("outside");

        const number =
            document.createElement("div");

        number.className =
            "calendar-day-number";

        number.textContent = day;

        cell.appendChild(number);

        return cell;
    }

    const year =
        currentDate.getFullYear();

    const month =
        currentDate.getMonth();

    const dateString =
        `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const number =
        document.createElement("div");

    number.className =
        "calendar-day-number";

    number.textContent = day;

    cell.appendChild(number);

    const today = new Date();

    if (
        today.getFullYear() === year &&
        today.getMonth() === month &&
        today.getDate() === day
    ) {
        cell.classList.add("today");
    }

    /* Duplo clique */

    cell.addEventListener(
        "dblclick",
        () => {
            openContentModalForDate(
                dateString
            );
        }
    );

    /* Conteúdos */

    const dayContents =
        getFilteredContents().filter(
            item =>
                isSameCalendarDate(
                    item.data_publicacao,
                    year,
                    month,
                    day
                )
        );

    dayContents.forEach(content => {
        cell.appendChild(
            createCalendarContent(
                content
            )
        );
    });

    /* Produção */

    const dayTasks = tasks.filter(
        task =>
            isSameCalendarDate(
                task.data_tarefa,
                year,
                month,
                day
            )
    );

    dayTasks.forEach(task => {
        cell.appendChild(
            createCalendarTask(task)
        );
    });

    /* Botão + */

    const addButton =
        document.createElement("button");

    addButton.type = "button";
    addButton.className = "calendar-add";
    addButton.textContent = "+";
    addButton.title = "Adicionar conteúdo";

    addButton.addEventListener(
        "click",
        event => {
            event.stopPropagation();

            openContentModalForDate(
                dateString
            );
        }
    );

    cell.appendChild(addButton);

    return cell;
}

/* =========================================================
   CALENDÁRIO SEMANAL
========================================================= */

function renderWeekCalendar() {
    const grid = document.getElementById(
        "calendarGrid"
    );

    const title = document.getElementById(
        "calendarMonth"
    );

    if (!grid) {
        return;
    }

    const start =
        startOfWeek(currentDate);

    const end = new Date(start);

    end.setDate(
        end.getDate() + 6
    );

    if (title) {
        title.textContent =
            `${formatDayMonth(start)} — ${formatDayMonth(end)}`;
    }

    grid.innerHTML = "";

    for (
        let i = 0;
        i < 7;
        i++
    ) {
        const date =
            new Date(start);

        date.setDate(
            date.getDate() + i
        );

        const cell =
            document.createElement("div");

        cell.className =
            "calendar-day week-day";

        if (
            isSameDay(
                date,
                new Date()
            )
        ) {
            cell.classList.add("today");
        }

        const number =
            document.createElement("div");

        number.className =
            "calendar-day-number";

        number.textContent =
            date.toLocaleDateString(
                "pt-BR",
                {
                    weekday: "short",
                    day: "2-digit"
                }
            );

        cell.appendChild(number);

        const dayContents =
            getFilteredContents().filter(
                item =>
                    isSameDay(
                        parseDate(
                            item.data_publicacao
                        ),
                        date
                    )
            );

        dayContents.forEach(content => {
            cell.appendChild(
                createCalendarContent(
                    content
                )
            );
        });

        tasks
            .filter(
                task =>
                    isSameDay(
                        parseDate(
                            task.data_tarefa
                        ),
                        date
                    )
            )
            .forEach(task => {
                cell.appendChild(
                    createCalendarTask(
                        task
                    )
                );
            });

        const addButton =
            document.createElement("button");

        addButton.type = "button";
        addButton.className = "calendar-add";
        addButton.textContent = "+";
        addButton.title = "Adicionar conteúdo";

        addButton.addEventListener(
            "click",
            () => {
                openContentModalForDate(
                    formatInputDate(date)
                );
            }
        );

        cell.appendChild(addButton);

        grid.appendChild(cell);
    }
}

/* =========================================================
   AGENDA
========================================================= */

function renderAgenda() {
    const grid = document.getElementById(
        "calendarGrid"
    );

    const title = document.getElementById(
        "calendarMonth"
    );

    if (!grid) {
        return;
    }

    if (title) {
        title.textContent =
            "Agenda de marketing";
    }

    const items = [];

    getFilteredContents().forEach(
        content => {
            const date =
                parseDate(
                    content.data_publicacao
                );

            if (date) {
                items.push({
                    type: "content",
                    date,
                    data: content
                });
            }
        }
    );

    tasks.forEach(task => {
        const date =
            parseDate(
                task.data_tarefa
            );

        if (date) {
            items.push({
                type: "task",
                date,
                data: task
            });
        }
    });

    items.sort(
        (a, b) =>
            a.date - b.date
    );

    if (!items.length) {
        grid.innerHTML = `
            <div class="content-empty">
                <div class="empty-icon">✦</div>
                <h3>Nenhuma atividade cadastrada</h3>
                <p>Adicione conteúdos ou tarefas ao calendário.</p>
            </div>
        `;

        return;
    }

    grid.innerHTML = `
        <div class="agenda-list">
            ${items
                .map(item =>
                    item.type === "task"
                        ? renderAgendaTask(item.data)
                        : renderAgendaContent(item.data)
                )
                .join("")}
        </div>
    `;

    bindAgendaActions();
}

/* =========================================================
   AGENDA — CONTEÚDO
========================================================= */

function renderAgendaContent(content) {
    return `
        <button
            type="button"
            class="agenda-item"
            data-content-id="${esc(content.id)}"
        >

            <div class="agenda-date">
                <strong>
                    ${esc(
                        formatDayMonth(
                            content.data_publicacao
                        )
                    )}
                </strong>

                <span>
                    ${esc(
                        formatTime(
                            content.data_publicacao
                        )
                    )}
                </span>
            </div>

            <div class="agenda-info">

                <span class="upcoming-type">
                    ${esc(
                        content.tipo ||
                        content.formato ||
                        "CONTEÚDO"
                    )}
                </span>

                <strong>
                    ${esc(
                        content.titulo ||
                        "Conteúdo"
                    )}
                </strong>

                <small>
                    ${esc(
                        content.plataforma ||
                        "Sem plataforma"
                    )}

                    ${
                        content.responsavel
                            ? " • " +
                              esc(
                                  content.responsavel
                              )
                            : ""
                    }
                </small>

            </div>

            <span class="upcoming-status">
                ${esc(
                    content.status ||
                    "PLANEJADO"
                )}
            </span>

        </button>
    `;
}

/* =========================================================
   AGENDA — TAREFA
========================================================= */

function renderAgendaTask(task) {
    return `
        <button
            type="button"
            class="agenda-item task-item"
            data-task-id="${esc(task.id)}"
        >

            <div class="agenda-date">
                <strong>
                    ${esc(
                        formatDayMonth(
                            task.data_tarefa
                        )
                    )}
                </strong>

                <span>
                    ${esc(
                        formatTime(
                            task.data_tarefa
                        )
                    )}
                </span>
            </div>

            <div class="agenda-info">

                <span class="upcoming-type">
                    PRODUÇÃO
                </span>

                <strong>
                    ${esc(
                        task.titulo ||
                        "Tarefa"
                    )}
                </strong>

                <small>
                    ${esc(
                        task.responsavel ||
                        "Sem responsável"
                    )}
                </small>

            </div>

            <span class="upcoming-status">
                ${esc(
                    task.status ||
                    "PENDENTE"
                )}
            </span>

        </button>
    `;
}

/* =========================================================
   AÇÕES DA AGENDA
========================================================= */

function bindAgendaActions() {
    document
        .querySelectorAll(
            ".agenda-item[data-content-id]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    const id =
                        button.dataset.contentId;

                    const content =
                        contents.find(
                            item =>
                                String(item.id) ===
                                String(id)
                        );

                    if (content) {
                        openViewContentModal(
                            content
                        );
                    }
                }
            );
        });

    document
        .querySelectorAll(
            ".agenda-item[data-task-id]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    const id =
                        button.dataset.taskId;

                    const task =
                        tasks.find(
                            item =>
                                String(item.id) ===
                                String(id)
                        );

                    if (task) {
                        openTaskModal(task);
                    }
                }
            );
        });
}

/* =========================================================
   CONTEÚDO NO CALENDÁRIO
========================================================= */

function createCalendarContent(content) {
    const item =
        document.createElement("button");

    item.type = "button";
    item.className = "calendar-content";

    const status =
        upper(
            content.status ||
            "PLANEJADO"
        );

    item.classList.add(
        getStatusClass(status)
    );

    item.innerHTML = `
        <span class="calendar-content-time">
            ${esc(
                formatTime(
                    content.data_publicacao
                )
            )}
        </span>

        <strong>
            ${esc(
                content.titulo ||
                "Conteúdo"
            )}
        </strong>

        <span class="calendar-content-meta">
            ${esc(
                content.tipo ||
                content.formato ||
                "Conteúdo"
            )}

            ${
                content.plataforma
                    ? " • " +
                      esc(
                          content.plataforma
                      )
                    : ""
            }
        </span>
    `;

    item.addEventListener(
        "click",
        event => {
            event.stopPropagation();

            openViewContentModal(
                content
            );
        }
    );

    return item;
}

/* =========================================================
   TAREFA NO CALENDÁRIO
========================================================= */

function createCalendarTask(task) {
    const item =
        document.createElement("button");

    item.type = "button";
    item.className =
        "calendar-content calendar-task";

    item.classList.add(
        getTaskStatusClass(
            task.status
        )
    );

    item.innerHTML = `
        <span class="calendar-content-time">
            ${esc(
                formatTime(
                    task.data_tarefa
                )
            )}
        </span>

        <strong>
            ${esc(
                task.titulo ||
                "Produção"
            )}
        </strong>

        <span class="calendar-content-meta">
            PRODUÇÃO
        </span>
    `;

    item.addEventListener(
        "click",
        event => {
            event.stopPropagation();

            openTaskModal(task);
        }
    );

    return item;
}

/* =========================================================
   PRÓXIMOS
========================================================= */

function renderUpcoming() {
    const container =
        document.getElementById(
            "upcomingContents"
        );

    if (!container) {
        return;
    }

    const now = new Date();

    const items = [];

    getFilteredContents().forEach(
        content => {
            const date =
                parseDate(
                    content.data_publicacao
                );

            if (
                date &&
                date >= now
            ) {
                items.push({
                    type: "content",
                    date,
                    data: content
                });
            }
        }
    );

    tasks.forEach(task => {
        const date =
            parseDate(
                task.data_tarefa
            );

        if (
            date &&
            date >= now
        ) {
            items.push({
                type: "task",
                date,
                data: task
            });
        }
    });

    items.sort(
        (a, b) =>
            a.date - b.date
    );

    const nextItems =
        items.slice(0, 10);

    if (!nextItems.length) {
        container.innerHTML = `
            <div class="content-empty">
                <div class="empty-icon">✦</div>

                <h3>
                    Nenhuma atividade próxima
                </h3>

                <p>
                    Adicione conteúdos ou tarefas
                    ao calendário.
                </p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        nextItems
            .map(item =>
                item.type === "task"
                    ? renderUpcomingTask(
                        item.data
                    )
                    : renderUpcomingContent(
                        item.data
                    )
            )
            .join("");

    bindUpcomingActions();
}

/* =========================================================
   PRÓXIMO CONTEÚDO
========================================================= */

function renderUpcomingContent(content) {
    const status =
        upper(
            content.status ||
            "PLANEJADO"
        );

    return `
        <button
            type="button"
            class="upcoming-item ${getStatusClass(status)}"
            data-content-id="${esc(content.id)}"
        >

            <div class="upcoming-date">
                <strong>
                    ${esc(
                        formatDayMonth(
                            content.data_publicacao
                        )
                    )}
                </strong>

                <span>
                    ${esc(
                        formatTime(
                            content.data_publicacao
                        )
                    )}
                </span>
            </div>

            <div class="upcoming-info">

                <span class="upcoming-type">
                    ${esc(
                        content.tipo ||
                        content.formato ||
                        "CONTEÚDO"
                    )}
                </span>

                <strong>
                    ${esc(
                        content.titulo ||
                        "Conteúdo sem título"
                    )}
                </strong>

                <small>
                    ${esc(
                        content.plataforma ||
                        "Sem plataforma"
                    )}

                    ${
                        content.responsavel
                            ? " • " +
                              esc(
                                  content.responsavel
                              )
                            : ""
                    }
                </small>

            </div>

            <span class="upcoming-status">
                ${esc(status)}
            </span>

        </button>
    `;
}

/* =========================================================
   PRÓXIMA TAREFA
========================================================= */

function renderUpcomingTask(task) {
    const status =
        upper(
            task.status ||
            "PENDENTE"
        );

    return `
        <button
            type="button"
            class="upcoming-item task-item"
            data-task-id="${esc(task.id)}"
        >

            <div class="upcoming-date">

                <strong>
                    ${esc(
                        formatDayMonth(
                            task.data_tarefa
                        )
                    )}
                </strong>

                <span>
                    ${esc(
                        formatTime(
                            task.data_tarefa
                        )
                    )}
                </span>

            </div>

            <div class="upcoming-info">

                <span class="upcoming-type">
                    PRODUÇÃO
                </span>

                <strong>
                    ${esc(
                        task.titulo ||
                        "Tarefa"
                    )}
                </strong>

                <small>
                    ${esc(
                        task.responsavel ||
                        "Sem responsável"
                    )}
                </small>

            </div>

            <span class="upcoming-status">
                ${esc(status)}
            </span>

        </button>
    `;
}

/* =========================================================
   AÇÕES PRÓXIMOS
========================================================= */

function bindUpcomingActions() {
    document
        .querySelectorAll(
            ".upcoming-item[data-content-id]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    const id =
                        button.dataset.contentId;

                    const content =
                        contents.find(
                            item =>
                                String(item.id) ===
                                String(id)
                        );

                    if (content) {
                        openViewContentModal(
                            content
                        );
                    }
                }
            );
        });

    document
        .querySelectorAll(
            ".upcoming-item[data-task-id]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    const id =
                        button.dataset.taskId;

                    const task =
                        tasks.find(
                            item =>
                                String(item.id) ===
                                String(id)
                        );

                    if (task) {
                        openTaskModal(task);
                    }
                }
            );
        });
}

/* =========================================================
   IDEIAS
========================================================= */

function renderIdeas() {
    const grid =
        document.getElementById(
            "ideasGrid"
        );

    if (!grid) {
        return;
    }

    let filteredIdeas =
        [...ideas];

    if (
        activeIdeaFilter !==
        "todos"
    ) {
        filteredIdeas =
            filteredIdeas.filter(
                idea =>
                    upper(
                        idea.tipo ||
                        idea.formato
                    ) ===
                    upper(
                        activeIdeaFilter
                    )
            );
    }

    if (!filteredIdeas.length) {
        grid.innerHTML = `
            <div class="content-empty">

                <div class="empty-icon">
                    ✦
                </div>

                <h3>
                    Nenhuma ideia encontrada
                </h3>

                <p>
                    Registre uma ideia de conteúdo
                    para a equipe.
                </p>

                <button
                    type="button"
                    class="primary-small-btn"
                    id="emptyIdeaButton"
                >
                    + REGISTRAR IDEIA
                </button>

            </div>
        `;

        const emptyButton =
            document.getElementById(
                "emptyIdeaButton"
            );

        if (emptyButton) {
            emptyButton.addEventListener(
                "click",
                openIdeaModal
            );
        }

        return;
    }

    grid.innerHTML =
        filteredIdeas
            .map(renderIdeaCard)
            .join("");

    bindIdeaActions();
}

/* =========================================================
   CARD DE IDEIA
========================================================= */

function renderIdeaCard(idea) {
    const priority =
        upper(
            idea.prioridade ||
            "NORMAL"
        );

    const type =
        upper(
            idea.tipo ||
            idea.formato ||
            "IDEIA"
        );

    return `
        <article
            class="idea-card"
            data-idea-id="${esc(idea.id)}"
        >

            <div class="idea-card-head">

                <span class="idea-status">
                    ${esc(type)}
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
                    ✦
                    ${esc(type)}
                </span>

                ${
                    idea.plataforma
                        ? `
                            <span>
                                •
                                ${esc(
                                    idea.plataforma
                                )}
                            </span>
                          `
                        : ""
                }

            </div>

            <div class="idea-footer">

                <span>
                    ${
                        idea.autor
                            ? "💡 " +
                              esc(
                                  idea.autor
                              )
                            : "💡 Equipe"
                    }
                </span>

                <span>
                    ${esc(
                        formatDate(
                            idea.created_at
                        )
                    )}
                </span>

            </div>

            <div class="idea-actions">

                <button
                    type="button"
                    class="outline-btn idea-convert-btn"
                    data-id="${esc(idea.id)}"
                >
                    TRANSFORMAR EM CONTEÚDO
                </button>

                <button
                    type="button"
                    class="idea-delete-btn"
                    data-id="${esc(idea.id)}"
                    title="Excluir ideia"
                >
                    🗑️ EXCLUIR
                </button>

            </div>

        </article>
    `;
}

/* =========================================================
   AÇÕES IDEIAS
========================================================= */

function bindIdeaActions() {

    /* =====================================================
       TRANSFORMAR EM CONTEÚDO
    ===================================================== */

    document
        .querySelectorAll(
            ".idea-convert-btn"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    const id =
                        button.dataset.id;

                    const idea =
                        ideas.find(
                            item =>
                                String(item.id) ===
                                String(id)
                        );

                    if (!idea) {
                        return;
                    }

                    convertIdeaToContent(
                        idea
                    );
                }
            );
        });

    /* =====================================================
       EXCLUIR IDEIA
    ===================================================== */

    document
        .querySelectorAll(
            ".idea-delete-btn"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    const id =
                        button.dataset.id;

                    deleteIdea(id);
                }
            );
        });
}

/* =========================================================
   EXCLUIR IDEIA
========================================================= */

async function deleteIdea(id) {

    const idea =
        ideas.find(
            item =>
                String(item.id) ===
                String(id)
        );

    if (!idea) {
        showMessage(
            "Ideia não encontrada."
        );

        return;
    }

    const title =
        idea.titulo ||
        "Ideia sem título";

    const confirmed =
        confirm(
            `Deseja realmente excluir a ideia "${title}"?\n\nEssa ação não poderá ser desfeita.`
        );

    if (!confirmed) {
        return;
    }

    const card =
        document.querySelector(
            `.idea-card[data-idea-id="${CSS.escape(String(id))}"]`
        );

    const deleteButton =
        card
            ? card.querySelector(
                ".idea-delete-btn"
            )
            : null;

    try {

        /* =================================================
           DESABILITAR BOTÃO
        ================================================= */

        if (deleteButton) {
            deleteButton.disabled = true;
            deleteButton.textContent = "EXCLUINDO...";
        }

        /* =================================================
           EXCLUIR NO SUPABASE
        ================================================= */

        const {
            error
        } =
            await db
                .from(
                    "ideias_posts"
                )
                .delete()
                .eq(
                    "id",
                    id
                );

        if (error) {
            throw error;
        }

        /* =================================================
           REMOVER DO ESTADO LOCAL
        ================================================= */

        ideas =
            ideas.filter(
                item =>
                    String(item.id) !==
                    String(id)
            );

        /* =================================================
           REMOVER CARD DA TELA
        ================================================= */

        if (card) {
            card.remove();
        }

        /* =================================================
           ATUALIZAR RESUMO
        ================================================= */

        updateSummary();

        /* =================================================
           SE NÃO HOUVER MAIS IDEIAS
        ================================================= */

        const grid =
            document.getElementById(
                "ideasGrid"
            );

        if (
            grid &&
            ideas.filter(idea => {

                if (
                    activeIdeaFilter ===
                    "todos"
                ) {
                    return true;
                }

                return (
                    upper(
                        idea.tipo ||
                        idea.formato
                    ) ===
                    upper(
                        activeIdeaFilter
                    )
                );
            }).length === 0
        ) {
            renderIdeas();
        }

        /* =================================================
           MENSAGEM
        ================================================= */

        showMessage(
            "Ideia excluída com sucesso."
        );

    } catch (error) {

        console.error(
            "Erro ao excluir ideia:",
            error
        );

        if (deleteButton) {
            deleteButton.disabled = false;
            deleteButton.textContent = "🗑️ EXCLUIR";
        }

        showMessage(
            "Erro ao excluir ideia: " +
            getErrorMessage(error)
        );
    }
}

/* =========================================================
   TRANSFORMAR IDEIA EM CONTEÚDO
========================================================= */

function convertIdeaToContent(idea) {
    resetContentForm();

    setValue(
        "contentTitle",
        idea.titulo || ""
    );

    setValue(
        "contentDescription",
        idea.descricao || ""
    );

    setValue(
        "contentType",
        normalizeType(
            idea.tipo ||
            idea.formato
        )
    );

    setValue(
        "contentPlatform",
        idea.plataforma || ""
    );

    setValue(
        "contentFormat",
        normalizeFormat(
            idea.formato ||
            idea.tipo
        )
    );

    setValue(
        "contentPriority",
        normalizePriority(
            idea.prioridade
        )
    );

    setValue(
        "contentStatus",
        "PLANEJADO"
    );

    setText(
        "contentModalTitle",
        "Transformar ideia em conteúdo"
    );

    currentEditingContent = null;

    openContentModal();
}

/* =========================================================
   EVENTOS
========================================================= */

function bindEvents() {

    /* Atualizar */

    bindClick(
        "refreshMarketing",
        loadMarketing
    );

    /* Novo conteúdo */

    bindClick(
        "newContentBtn",
        () => {
            resetContentForm();
            openContentModal();
        }
    );

    /* Nova ideia */

    [
        "newIdeaBtn",
        "newIdeaBtnPanel"
    ].forEach(id => {
        bindClick(
            id,
            openIdeaModal
        );
    });

    /* Nova produção */

    bindClick(
        "newTaskBtn",
        () => {
            resetTaskForm();
            openTaskModal();
        }
    );

    /* =====================================================
       FECHAR MODAIS
    ===================================================== */

    bindClick(
        "closeContentModal",
        closeContentModal
    );

    bindClick(
        "cancelContentBtn",
        closeContentModal
    );

    bindClick(
        "closeIdeaModal",
        closeIdeaModal
    );

    bindClick(
        "closeTaskModal",
        closeTaskModal
    );

    bindClick(
        "closeViewContentModal",
        closeViewContentModal
    );

    /* =====================================================
       NAVEGAÇÃO CALENDÁRIO
    ===================================================== */

    bindClick(
        "prevMonth",
        () => {

            if (
                activeCalendarView ===
                "week"
            ) {
                currentDate.setDate(
                    currentDate.getDate() - 7
                );
            } else {
                currentDate.setMonth(
                    currentDate.getMonth() - 1
                );
            }

            renderCalendar();
        }
    );

    bindClick(
        "nextMonth",
        () => {

            if (
                activeCalendarView ===
                "week"
            ) {
                currentDate.setDate(
                    currentDate.getDate() + 7
                );
            } else {
                currentDate.setMonth(
                    currentDate.getMonth() + 1
                );
            }

            renderCalendar();
        }
    );

    bindClick(
        "todayBtn",
        () => {
            currentDate = new Date();
            renderCalendar();
        }
    );

    /* =====================================================
       FORMULÁRIO CONTEÚDO
    ===================================================== */

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

    /* =====================================================
       FORMULÁRIO IDEIA
    ===================================================== */

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

    /* =====================================================
       FORMULÁRIO TAREFA
    ===================================================== */

    const taskForm =
        document.getElementById(
            "taskForm"
        );

    if (taskForm) {
        taskForm.addEventListener(
            "submit",
            saveTask
        );
    }

    /* =====================================================
       EDITAR
    ===================================================== */

    bindClick(
        "editContentBtn",
        () => {

            if (
                currentViewingContent
            ) {
                openEditContentModal(
                    currentViewingContent
                );
            }
        }
    );

    /* =====================================================
       EXCLUIR CONTEÚDO
    ===================================================== */

    bindClick(
        "deleteContentBtn",
        deleteCurrentContent
    );

    /* =====================================================
       FILTROS
    ===================================================== */

    bindChange(
        "contentTypeFilter",
        refreshMarketingView
    );

    bindChange(
        "contentStatusFilter",
        refreshMarketingView
    );

    bindChange(
        "contentResponsibleFilter",
        refreshMarketingView
    );

    bindClick(
        "clearFilters",
        clearFilters
    );

    /* =====================================================
       VISUALIZAÇÃO
    ===================================================== */

    const calendarView =
        document.getElementById(
            "calendarView"
        );

    if (calendarView) {
        calendarView.addEventListener(
            "change",
            () => {

                activeCalendarView =
                    calendarView.value ||
                    "month";

                renderCalendar();
            }
        );
    }

    /* =====================================================
       FILTROS IDEIAS
    ===================================================== */

    document
        .querySelectorAll(
            "[data-idea-filter]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    document
                        .querySelectorAll(
                            "[data-idea-filter]"
                        )
                        .forEach(item =>
                            item.classList.remove(
                                "active"
                            )
                        );

                    button.classList.add(
                        "active"
                    );

                    activeIdeaFilter =
                        String(
                            button.dataset.ideaFilter ||
                            "todos"
                        ).toLowerCase();

                    renderIdeas();
                }
            );
        });

    /* =====================================================
       QUICK TASKS
    ===================================================== */

    document
        .querySelectorAll(
            ".quick-task"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    setValue(
                        "taskTitle",
                        button.dataset.task ||
                        ""
                    );
                }
            );
        });

    /* =====================================================
       CLIQUE FORA DO MODAL
    ===================================================== */

    document
        .querySelectorAll(
            ".modal"
        )
        .forEach(modal => {

            modal.addEventListener(
                "click",
                event => {

                    if (
                        event.target !==
                        modal
                    ) {
                        return;
                    }

                    if (
                        modal.id ===
                        "contentModal"
                    ) {
                        closeContentModal();
                        return;
                    }

                    if (
                        modal.id ===
                        "ideaModal"
                    ) {
                        closeIdeaModal();
                        return;
                    }

                    if (
                        modal.id ===
                        "taskModal"
                    ) {
                        closeTaskModal();
                        return;
                    }

                    if (
                        modal.id ===
                        "viewContentModal"
                    ) {
                        closeViewContentModal();
                        return;
                    }

                    modal.classList.add(
                        "hidden"
                    );
                }
            );
        });

    /* =====================================================
       ESC
    ===================================================== */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Escape"
            ) {
                closeAllModals();
            }
        }
    );
}

/* =========================================================
   ATUALIZAR VISUALIZAÇÃO
========================================================= */

function refreshMarketingView() {
    updateSummary();
    renderCalendar();
    renderUpcoming();
}

/* =========================================================
   APLICAR FILTROS
========================================================= */

function applyFilters() {
    refreshMarketingView();
}

/* =========================================================
   LIMPAR FILTROS
========================================================= */

function clearFilters() {

    setValue(
        "contentTypeFilter",
        "todos"
    );

    setValue(
        "contentStatusFilter",
        "todos"
    );

    setValue(
        "contentResponsibleFilter",
        "todos"
    );

    refreshMarketingView();
}

/* =========================================================
   MODAL CONTEÚDO
========================================================= */

function openContentModal() {

    const modal =
        document.getElementById(
            "contentModal"
        );

    if (!modal) {
        return;
    }

    modal.classList.remove(
        "hidden"
    );

    setText(
        "contentModalTitle",
        currentEditingContent
            ? "Editar conteúdo"
            : "Novo conteúdo"
    );
}

/* =========================================================
   FECHAR MODAL DE CONTEÚDO
========================================================= */

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

    currentEditingContent = null;
}

window.closeContentModal =
    closeContentModal;

/* =========================================================
   MODAL POR DATA
========================================================= */

function openContentModalForDate(
    dateString
) {

    resetContentForm();

    setValue(
        "contentDate",
        `${dateString}T09:00`
    );

    openContentModal();
}

/* =========================================================
   EDITAR CONTEÚDO
========================================================= */

function openEditContentModal(
    content
) {

    currentEditingContent =
        content;

    closeViewContentModal();

    setValue(
        "contentId",
        content.id
    );

    setValue(
        "contentTitle",
        content.titulo
    );

    setValue(
        "contentType",
        normalizeType(
            content.tipo ||
            content.type ||
            content.formato
        )
    );

    setValue(
        "contentPlatform",
        content.plataforma
    );

    setValue(
        "contentFormat",
        content.formato
    );

    setValue(
        "contentDate",
        formatDateTimeLocal(
            content.data_publicacao
        )
    );

    setValue(
        "contentResponsible",
        content.responsavel
    );

    setValue(
        "contentStatus",
        content.status ||
        "PLANEJADO"
    );

    setValue(
        "contentPriority",
        content.prioridade ||
        "NORMAL"
    );

    setValue(
        "contentLocation",
        content.local
    );

    setValue(
        "contentParticipants",
        content.participantes
    );

    setValue(
        "contentDescription",
        content.descricao
    );

    setValue(
        "contentCaption",
        content.legenda
    );

    setValue(
        "contentImage",
        content.imagem_url
    );

    const deleteButton =
        document.getElementById(
            "deleteContentBtn"
        );

    if (deleteButton) {
        deleteButton.classList.remove(
            "hidden"
        );
    }

    openContentModal();
}

/* =========================================================
   RESET CONTEÚDO
========================================================= */

function resetContentForm() {

    currentEditingContent =
        null;

    const form =
        document.getElementById(
            "contentForm"
        );

    if (form) {
        form.reset();
    }

    setValue(
        "contentId",
        ""
    );

    setValue(
        "contentStatus",
        "PLANEJADO"
    );

    setValue(
        "contentPriority",
        "NORMAL"
    );

    const deleteButton =
        document.getElementById(
            "deleteContentBtn"
        );

    if (deleteButton) {
        deleteButton.classList.add(
            "hidden"
        );
    }

    setText(
        "contentModalTitle",
        "Novo conteúdo"
    );
}

/* =========================================================
   VISUALIZAR CONTEÚDO
========================================================= */

function openViewContentModal(
    content
) {

    currentViewingContent =
        content;

    setText(
        "viewContentType",
        content.tipo ||
        content.formato ||
        "CONTEÚDO"
    );

    setText(
        "viewContentTitle",
        content.titulo ||
        "Conteúdo sem título"
    );

    setText(
        "viewContentDate",
        formatDateTime(
            content.data_publicacao
        )
    );

    setText(
        "viewContentStatus",
        content.status ||
        "PLANEJADO"
    );

    setText(
        "viewContentResponsible",
        content.responsavel ||
        "Não definido"
    );

    setText(
        "viewContentDescription",
        content.descricao ||
        "Sem briefing."
    );

    setText(
        "viewContentCaption",
        content.legenda ||
        "Sem legenda ou roteiro."
    );

    const modal =
        document.getElementById(
            "viewContentModal"
        );

    if (modal) {
        modal.classList.remove(
            "hidden"
        );
    }
}

/* =========================================================
   FECHAR VISUALIZAÇÃO
========================================================= */

function closeViewContentModal() {

    const modal =
        document.getElementById(
            "viewContentModal"
        );

    if (modal) {
        modal.classList.add(
            "hidden"
        );
    }

    currentViewingContent = null;
}

/* =========================================================
   SALVAR CONTEÚDO
========================================================= */

async function saveContent(
    event
) {

    event.preventDefault();

    const button =
        event.target.querySelector(
            "button[type='submit']"
        );

    setButtonLoading(
        button,
        "SALVANDO..."
    );

    try {

        const title =
            getValue(
                "contentTitle"
            );

        const dateValue =
            getValue(
                "contentDate"
            );

        if (!title) {
            throw new Error(
                "Informe o título do conteúdo."
            );
        }

        if (!dateValue) {
            throw new Error(
                "Informe a data do conteúdo."
            );
        }

        const payload = {

            titulo:
                title,

            tipo:
                getValue(
                    "contentType"
                ),

            plataforma:
                getValue(
                    "contentPlatform"
                ),

            formato:
                getValue(
                    "contentFormat"
                ),

            data_publicacao:
                new Date(
                    dateValue
                ).toISOString(),

            responsavel:
                getValue(
                    "contentResponsible"
                ),

            status:
                getValue(
                    "contentStatus"
                ) ||
                "PLANEJADO",

            prioridade:
                getValue(
                    "contentPriority"
                ) ||
                "NORMAL",

            local:
                getValue(
                    "contentLocation"
                ),

            participantes:
                getValue(
                    "contentParticipants"
                ),

            descricao:
                getValue(
                    "contentDescription"
                ),

            legenda:
                getValue(
                    "contentCaption"
                ),

            imagem_url:
                getValue(
                    "contentImage"
                ),

            updated_at:
                new Date().toISOString()
        };

        const id =
            getValue(
                "contentId"
            );

        let result;

        if (id) {

            result =
                await db
                    .from(
                        "conteudos_marketing"
                    )
                    .update(
                        payload
                    )
                    .eq(
                        "id",
                        id
                    );

        } else {

            result =
                await db
                    .from(
                        "conteudos_marketing"
                    )
                    .insert(
                        payload
                    );
        }

        if (result.error) {
            throw result.error;
        }

        closeContentModal();

        showMessage(
            id
                ? "Conteúdo atualizado com sucesso."
                : "Conteúdo criado com sucesso."
        );

        await loadMarketing();

    } catch (error) {

        console.error(
            "Erro ao salvar conteúdo:",
            error
        );

        showMessage(
            "Erro ao salvar conteúdo: " +
            getErrorMessage(error)
        );

    } finally {

        setButtonLoading(
            button,
            "SALVAR CONTEÚDO"
        );
    }
}

/* =========================================================
   EXCLUIR CONTEÚDO
========================================================= */

async function deleteCurrentContent() {

    const content =
        currentViewingContent ||
        currentEditingContent;

    if (!content) {
        return;
    }

    if (
        !confirm(
            `Excluir o conteúdo "${content.titulo || "sem título"}"?`
        )
    ) {
        return;
    }

    try {

        const {
            error
        } =
            await db
                .from(
                    "conteudos_marketing"
                )
                .delete()
                .eq(
                    "id",
                    content.id
                );

        if (error) {
            throw error;
        }

        closeAllModals();

        currentViewingContent =
            null;

        currentEditingContent =
            null;

        showMessage(
            "Conteúdo excluído com sucesso."
        );

        await loadMarketing();

    } catch (error) {

        console.error(
            "Erro ao excluir conteúdo:",
            error
        );

        showMessage(
            "Erro ao excluir conteúdo: " +
            getErrorMessage(error)
        );
    }
}

/* =========================================================
   MODAL IDEIA
========================================================= */

function openIdeaModal() {

    const modal =
        document.getElementById(
            "ideaModal"
        );

    if (!modal) {
        return;
    }

    modal.classList.remove(
        "hidden"
    );
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

/* =========================================================
   SALVAR IDEIA
========================================================= */

async function saveIdea(
    event
) {

    event.preventDefault();

    const button =
        event.target.querySelector(
            "button[type='submit']"
        );

    setButtonLoading(
        button,
        "SALVANDO..."
    );

    try {

        const title =
            getValue(
                "ideaTitle"
            );

        if (!title) {
            throw new Error(
                "Informe o título da ideia."
            );
        }

        const idea = {

            titulo:
                title,

            descricao:
                getValue(
                    "ideaDescription"
                ),

            plataforma:
                "",

            formato:
                getValue(
                    "ideaType"
                ),

            prioridade:
                getValue(
                    "ideaPriority"
                ) ||
                "NORMAL",

            autor:
                getValue(
                    "ideaAuthor"
                ),

            status:
                "NOVA",

            updated_at:
                new Date().toISOString()
        };

        const {
            error
        } =
            await db
                .from(
                    "ideias_posts"
                )
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
            getErrorMessage(error)
        );

    } finally {

        setButtonLoading(
            button,
            "SALVAR IDEIA"
        );
    }
}

/* =========================================================
   MODAL PRODUÇÃO
========================================================= */

function openTaskModal(
    task = null
) {

    const modal =
        document.getElementById(
            "taskModal"
        );

    if (!modal) {
        return;
    }

    currentEditingTask =
        task;

    if (task) {

        setText(
            "taskModalTitle",
            "Editar produção"
        );

        setValue(
            "taskTitle",
            task.titulo
        );

        setValue(
            "taskDate",
            formatDateTimeLocal(
                task.data_tarefa
            )
        );

        setValue(
            "taskResponsible",
            task.responsavel
        );

        setValue(
            "taskDescription",
            task.descricao
        );

        setValue(
            "taskStatus",
            task.status ||
            "PENDENTE"
        );

    } else {

        setText(
            "taskModalTitle",
            "Nova produção"
        );
    }

    modal.classList.remove(
        "hidden"
    );
}

function closeTaskModal() {

    const modal =
        document.getElementById(
            "taskModal"
        );

    if (modal) {
        modal.classList.add(
            "hidden"
        );
    }

    currentEditingTask =
        null;
}

function resetTaskForm() {

    currentEditingTask =
        null;

    const form =
        document.getElementById(
            "taskForm"
        );

    if (form) {
        form.reset();
    }

    setValue(
        "taskStatus",
        "PENDENTE"
    );

    setText(
        "taskModalTitle",
        "Nova produção"
    );
}

/* =========================================================
   SALVAR TAREFA
========================================================= */

async function saveTask(
    event
) {

    event.preventDefault();

    const button =
        event.target.querySelector(
            "button[type='submit']"
        );

    setButtonLoading(
        button,
        "SALVANDO..."
    );

    try {

        const title =
            getValue(
                "taskTitle"
            );

        const dateValue =
            getValue(
                "taskDate"
            );

        if (!title) {
            throw new Error(
                "Informe o nome da produção."
            );
        }

        if (!dateValue) {
            throw new Error(
                "Informe a data da produção."
            );
        }

        const editingId =
            currentEditingTask &&
            currentEditingTask.id
                ? currentEditingTask.id
                : null;

        const payload = {

            titulo:
                title,

            data_tarefa:
                new Date(
                    dateValue
                ).toISOString(),

            responsavel:
                getValue(
                    "taskResponsible"
                ),

            descricao:
                getValue(
                    "taskDescription"
                ),

            status:
                getValue(
                    "taskStatus"
                ) ||
                "PENDENTE",

            updated_at:
                new Date().toISOString()
        };

        let result;

        if (editingId) {

            result =
                await db
                    .from(
                        "tarefas_marketing"
                    )
                    .update(
                        payload
                    )
                    .eq(
                        "id",
                        editingId
                    );

        } else {

            result =
                await db
                    .from(
                        "tarefas_marketing"
                    )
                    .insert(
                        payload
                    );
        }

        if (result.error) {
            throw result.error;
        }

        event.target.reset();

        closeTaskModal();

        showMessage(
            editingId
                ? "Produção atualizada com sucesso."
                : "Produção cadastrada com sucesso."
        );

        await loadMarketing();

    } catch (error) {

        console.error(
            "Erro ao salvar produção:",
            error
        );

        showMessage(
            "Erro ao salvar produção: " +
            getErrorMessage(error)
        );

    } finally {

        setButtonLoading(
            button,
            "SALVAR PRODUÇÃO"
        );
    }
}

/* =========================================================
   STATUS CONTEÚDO
========================================================= */

function getStatusClass(
    status
) {

    switch (
        upper(status)
    ) {

        case "PUBLICADO":
            return "published";

        case "AGENDADO":
            return "scheduled";

        case "EM_PRODUCAO":
        case "EM PRODUÇÃO":
            return "production";

        case "RASCUNHO":
        case "IDEIA":
            return "draft";

        default:
            return "planned";
    }
}

/* =========================================================
   STATUS TAREFA
========================================================= */

function getTaskStatusClass(
    status
) {

    switch (
        upper(status)
    ) {

        case "CONCLUIDA":
        case "CONCLUÍDA":
            return "published";

        case "EM_PRODUCAO":
        case "EM PRODUÇÃO":
            return "production";

        default:
            return "task";
    }
}

/* =========================================================
   NORMALIZAR TIPO
========================================================= */

function normalizeType(
    value
) {

    const type =
        upper(value);

    const allowed = [
        "POST",
        "REELS",
        "STORIES",
        "VIDEO",
        "CAMPANHA",
        "PRODUCAO"
    ];

    if (
        allowed.includes(type)
    ) {
        return type;
    }

    if (
        type === "VÍDEO"
    ) {
        return "VIDEO";
    }

    if (
        type === "PRODUÇÃO"
    ) {
        return "PRODUCAO";
    }

    return "";
}

/* =========================================================
   NORMALIZAR FORMATO
========================================================= */

function normalizeFormat(
    value
) {

    const type =
        upper(value);

    const formats = [
        "FEED",
        "REELS",
        "STORIES",
        "CARROSSEL",
        "VÍDEO",
        "VIDEO",
        "CAPTAÇÃO",
        "CAPTACAO",
        "OUTRO"
    ];

    if (
        formats.includes(type)
    ) {
        return type === "VIDEO"
            ? "VÍDEO"
            : type;
    }

    return "";
}

/* =========================================================
   NORMALIZAR PRIORIDADE
========================================================= */

function normalizePriority(
    value
) {

    const priority =
        upper(value);

    if (
        [
            "NORMAL",
            "ALTA",
            "URGENTE"
        ].includes(priority)
    ) {
        return priority;
    }

    return "NORMAL";
}

/* =========================================================
   UTILITÁRIOS
========================================================= */

function upper(
    value
) {

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
            value ?? "";
    }
}

function setValue(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );

    if (element) {
        element.value =
            value ?? "";
    }
}

function getValue(
    id
) {

    const element =
        document.getElementById(
            id
        );

    if (!element) {
        return "";
    }

    return String(
        element.value ?? ""
    ).trim();
}

function bindClick(
    id,
    handler
) {

    const element =
        document.getElementById(
            id
        );

    if (
        element &&
        typeof handler ===
        "function"
    ) {

        element.addEventListener(
            "click",
            handler
        );
    }
}

function bindChange(
    id,
    handler
) {

    const element =
        document.getElementById(
            id
        );

    if (
        element &&
        typeof handler ===
        "function"
    ) {

        element.addEventListener(
            "change",
            handler
        );
    }
}

/* =========================================================
   DATAS
========================================================= */

function parseDate(
    value
) {

    if (!value) {
        return null;
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return null;
    }

    return date;
}

function formatDate(
    value
) {

    const date =
        parseDate(value);

    if (!date) {
        return "—";
    }

    return date.toLocaleDateString(
        "pt-BR"
    );
}

function formatTime(
    value
) {

    const date =
        parseDate(value);

    if (!date) {
        return "—";
    }

    return date.toLocaleTimeString(
        "pt-BR",
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}

function formatDateTime(
    value
) {

    const date =
        parseDate(value);

    if (!date) {
        return "—";
    }

    return (
        date.toLocaleDateString(
            "pt-BR"
        ) +
        " • " +
        date.toLocaleTimeString(
            "pt-BR",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        )
    );
}

function formatDateTimeLocal(
    value
) {

    const date =
        parseDate(value);

    if (!date) {
        return "";
    }

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(
            2,
            "0"
        );

    const day =
        String(
            date.getDate()
        ).padStart(
            2,
            "0"
        );

    const hours =
        String(
            date.getHours()
        ).padStart(
            2,
            "0"
        );

    const minutes =
        String(
            date.getMinutes()
        ).padStart(
            2,
            "0"
        );

    return (
        `${year}-${month}-${day}` +
        `T${hours}:${minutes}`
    );
}

function formatInputDate(
    date
) {

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(
            2,
            "0"
        );

    const day =
        String(
            date.getDate()
        ).padStart(
            2,
            "0"
        );

    return (
        `${year}-${month}-${day}`
    );
}

function formatDayMonth(
    value
) {

    const date =
        value instanceof Date
            ? value
            : parseDate(value);

    if (!date) {
        return "—";
    }

    return date.toLocaleDateString(
        "pt-BR",
        {
            day: "2-digit",
            month: "2-digit"
        }
    );
}

function startOfDay(
    date
) {

    const result =
        new Date(date);

    result.setHours(
        0,
        0,
        0,
        0
    );

    return result;
}

function endOfDay(
    date
) {

    const result =
        new Date(date);

    result.setHours(
        23,
        59,
        59,
        999
    );

    return result;
}

function startOfWeek(
    date
) {

    const result =
        new Date(date);

    result.setHours(
        0,
        0,
        0,
        0
    );

    const day =
        result.getDay();

    const diff =
        day === 0
            ? -6
            : 1 - day;

    result.setDate(
        result.getDate() + diff
    );

    return result;
}

function isSameDay(
    dateA,
    dateB
) {

    if (
        !dateA ||
        !dateB
    ) {
        return false;
    }

    return (
        dateA.getFullYear() ===
        dateB.getFullYear() &&
        dateA.getMonth() ===
        dateB.getMonth() &&
        dateA.getDate() ===
        dateB.getDate()
    );
}

function isSameCalendarDate(
    value,
    year,
    month,
    day
) {

    const date =
        parseDate(value);

    if (!date) {
        return false;
    }

    return (
        date.getFullYear() ===
        year &&
        date.getMonth() ===
        month &&
        date.getDate() ===
        day
    );
}

function isCurrentMonth(
    value
) {

    const date =
        parseDate(value);

    if (!date) {
        return false;
    }

    return (
        date.getMonth() ===
        currentDate.getMonth() &&
        date.getFullYear() ===
        currentDate.getFullYear()
    );
}

/* =========================================================
   CAPITALIZAR
========================================================= */

function capitalize(
    value
) {

    if (!value) {
        return "";
    }

    return (
        value.charAt(0).toUpperCase() +
        value.slice(1)
    );
}

/* =========================================================
   ESC HTML
========================================================= */

function esc(
    value
) {

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

/* =========================================================
   BOTÃO LOADING
========================================================= */

function setButtonLoading(
    button,
    text
) {

    if (!button) {
        return;
    }

    if (
        text ===
        "SALVANDO..."
    ) {

        if (
            !button.dataset.originalText
        ) {

            button.dataset.originalText =
                button.textContent;
        }

        button.disabled =
            true;

        button.textContent =
            text;

    } else {

        button.disabled =
            false;

        button.textContent =
            button.dataset.originalText ||
            text;

        delete button.dataset.originalText;
    }
}

/* =========================================================
   MENSAGEM
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

    clearTimeout(
        window.marketingMessageTimer
    );

    window.marketingMessageTimer =
        setTimeout(
            hideMessage,
            5000
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

/* =========================================================
   LOADING
========================================================= */

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

    const calendar =
        document.getElementById(
            "calendarGrid"
        );

    if (calendar) {
        calendar.innerHTML = `
            <div class="content-loading">
                Carregando calendário...
            </div>
        `;
    }
}

/* =========================================================
   FECHAR TODOS OS MODAIS
========================================================= */

function closeAllModals() {

    closeContentModal();
    closeIdeaModal();
    closeTaskModal();
    closeViewContentModal();

    document
        .querySelectorAll(
            ".modal"
        )
        .forEach(modal => {
            modal.classList.add(
                "hidden"
            );
        });

    currentEditingContent = null;
    currentViewingContent = null;
    currentEditingTask = null;
}

/* =========================================================
   ERRO
========================================================= */

function getErrorMessage(
    error
) {

    if (!error) {
        return "Erro desconhecido.";
    }

    return (
        error.message ||
        error.details ||
        error.hint ||
        String(error)
    );
}

/* =========================================================
   LOGOUT
========================================================= */

document.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                "#logoutBtn"
            );

        if (!button) {
            return;
        }

        if (
            window.crmAuth &&
            typeof window.crmAuth.logout ===
            "function"
        ) {

            window.crmAuth.logout();
        }
    }
);

/* =========================================================
   INICIAR
========================================================= */

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