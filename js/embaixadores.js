
"use strict";

/* =========================================================
   RUN & SAMBA CRM 2026
   MÓDULO DE EMBAIXADORES
   SUPABASE • CADASTRO • INDICAÇÕES • RANKING • LINKS
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    /* =====================================================
       1. CONFIGURAÇÕES
    ===================================================== */

    const supabaseClient =
        window.supabaseClient ||
        window.sb ||
        window.db;

    const TABLE_EMBAIXADORES = "embaixadores";
    const TABLE_INSCRICOES = "inscricoes";
    const TABLE_ACOES = "embaixador_acoes";

    const REGISTRATION_URL =
        window.RUN_SAMBA_REGISTRATION_URL ||
        new URL("inscricoes.html", window.location.href).href;

    let embaixadores = [];
    let inscricoes = [];
    let inscricoesDisponiveis = false;
    let embaixadorSelecionado = null;

    const $ = (id) => document.getElementById(id);


    /* =====================================================
       2. ELEMENTOS HTML
    ===================================================== */

    const form = $("embaixadorForm");

    const formAcao = $("acaoEmbaixadorForm");

    const lista = $("listaEmbaixadores");

    const ranking = $("rankingEmbaixadores");

    const mensagem = $("mensagemEmbaixador");

    const mensagemLista = $("mensagemLista");

    const mensagemLink = $("mensagemLink");

    const mensagemAcao = $("mensagemAcao");

    const linkCompartilhamento =
        $("linkCompartilhamento");

    const logoutBtn = $("logoutBtn");

    const copiarLinkBtn = $("copiarLinkBtn");

    const limparFormulario = $("limparFormulario");


    /* =====================================================
       3. VERIFICAR CLIENTE SUPABASE
    ===================================================== */

    if (
        !supabaseClient ||
        typeof supabaseClient.from !== "function"
    ) {

        console.error(
            "Cliente Supabase não encontrado. Verifique js/config.js."
        );

        mostrarMensagem(
            mensagemLista,
            "Cliente Supabase não encontrado. Confira o arquivo js/config.js.",
            "erro"
        );

        if (lista) {

            lista.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        Não foi possível conectar ao Supabase.
                    </td>
                </tr>
            `;

        }

        return;

    }


    /* =====================================================
       4. MENSAGENS
    ===================================================== */

    function mostrarMensagem(
        elemento,
        texto,
        tipo = "sucesso"
    ) {

        if (!elemento) return;

        elemento.textContent = texto;

        elemento.style.display = "block";

        elemento.style.color =
            tipo === "erro"
                ? "#a33c3c"
                : tipo === "aviso"
                    ? "#a96919"
                    : "#24784e";

    }


    function limparMensagem(elemento) {

        if (!elemento) return;

        elemento.textContent = "";

        elemento.style.display = "none";

    }


    /* =====================================================
       5. SEGURANÇA E FORMATAÇÃO
    ===================================================== */

    function escaparHTML(valor) {

        return String(valor ?? "").replace(
            /[&<>"']/g,
            caractere => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            })[caractere]
        );

    }


    function normalizarCodigo(valor) {

        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase()
            .replace(/[^A-Z0-9_-]/g, "")
            .trim();

    }


    function formatarNumero(valor) {

        return Number(valor || 0).toLocaleString(
            "pt-BR"
        );

    }


    function statusAtivo(embaixador) {

        return String(
            embaixador.status || ""
        ).trim().toUpperCase() === "ATIVO";

    }


    function statusPago(inscricao) {

        const statusPagamento = String(
            inscricao.status_pagamento || ""
        ).trim().toUpperCase();

        const statusGeral = String(
            inscricao.status || ""
        ).trim().toUpperCase();

        const statusAceitos = [
            "PAGO",
            "PAID",
            "CONFIRMADO",
            "APROVADO",
            "RECEBIDO"
        ];

        return (
            statusAceitos.includes(statusPagamento) ||
            statusAceitos.includes(statusGeral)
        );

    }


    /* =====================================================
       6. GERAR LINK INDIVIDUAL
    ===================================================== */

    function gerarLink(codigo) {

        const url = new URL(REGISTRATION_URL);

        url.searchParams.set(
            "embaixador",
            codigo
        );

        return url.toString();

    }


    /* =====================================================
       7. BUSCAR INDICAÇÕES
    ===================================================== */

    function obterIndicacoes(embaixador) {

        if (!inscricoesDisponiveis) {
            return [];
        }

        const codigoEmbaixador = String(
            embaixador.codigo || ""
        ).trim().toUpperCase();

        return inscricoes.filter(inscricao => {

            const codigoInscricao = String(
                inscricao.codigo_embaixador || ""
            ).trim().toUpperCase();

            return (
                codigoInscricao !== "" &&
                codigoInscricao === codigoEmbaixador
            );

        });

    }


    function obterPagas(embaixador) {

        return obterIndicacoes(embaixador)
            .filter(statusPago);

    }


    /* =====================================================
       8. CARREGAR EMBAIXADORES
    ===================================================== */

    async function carregarEmbaixadores() {

        const resposta = await supabaseClient
            .from(TABLE_EMBAIXADORES)
            .select("*")
            .order("criado_em", {
                ascending: false
            });

        if (resposta.error) {

            console.error(
                "Erro ao carregar embaixadores:",
                resposta.error
            );

            throw resposta.error;

        }

        embaixadores = resposta.data || [];

    }


    /* =====================================================
       9. CARREGAR INDICAÇÕES
       NÃO CONSULTA DADOS PESSOAIS
    ===================================================== */

    async function carregarInscricoes() {

        inscricoes = [];

        inscricoesDisponiveis = false;

        const resposta = await supabaseClient
            .from(TABLE_INSCRICOES)
            .select(
                "id, codigo_embaixador, status_pagamento, status"
            )
            .not(
                "codigo_embaixador",
                "is",
                null
            );

        if (resposta.error) {

            console.error(
                "Erro ao consultar indicações:",
                resposta.error
            );

            return false;

        }

        inscricoes = resposta.data || [];

        inscricoesDisponiveis = true;

        return true;

    }


    /* =====================================================
       10. CARREGAMENTO GERAL
    ===================================================== */

    async function carregarDados() {

        limparMensagem(mensagemLista);

        if (lista) {

            lista.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        Carregando embaixadores...
                    </td>
                </tr>
            `;

        }

        if (ranking) {

            ranking.innerHTML = `
                <div class="empty-state">
                    Carregando ranking...
                </div>
            `;

        }

        try {

            await carregarEmbaixadores();

            await carregarInscricoes();

            atualizarIndicadores();

            renderizarTabela();

            renderizarRanking();

            preencherSelectAcoes();

            if (!inscricoesDisponiveis) {

                mostrarMensagem(
                    mensagemLista,
                    "Embaixadores carregados, mas não foi possível consultar as indicações. Verifique as permissões SELECT da tabela inscricoes.",
                    "aviso"
                );

            }

        } catch (erro) {

            console.error(
                "Erro ao carregar dados:",
                erro
            );

            mostrarMensagem(
                mensagemLista,
                interpretarErro(erro),
                "erro"
            );

            if (lista) {

                lista.innerHTML = `
                    <tr>
                        <td colspan="6" class="empty-state">
                            Não foi possível carregar os embaixadores.
                        </td>
                    </tr>
                `;

            }

        }

    }


    /* =====================================================
       11. INDICADORES
    ===================================================== */

    function atualizarIndicadores() {

        const ativos = embaixadores.filter(
            statusAtivo
        );

        if (!inscricoesDisponiveis) {

            $("totalEmbaixadores").textContent =
                formatarNumero(ativos.length);

            $("totalIndicacoes").textContent = "—";

            $("totalPagas").textContent = "—";

            $("taxaConversao").textContent = "—";

            return;

        }

        let totalIndicacoes = 0;

        let totalPagas = 0;

        embaixadores.forEach(embaixador => {

            const indicacoes =
                obterIndicacoes(embaixador);

            const pagas =
                indicacoes.filter(statusPago);

            totalIndicacoes += indicacoes.length;

            totalPagas += pagas.length;

        });

        const conversao = totalIndicacoes > 0
            ? (totalPagas / totalIndicacoes) * 100
            : 0;

        if ($("totalEmbaixadores")) {

            $("totalEmbaixadores").textContent =
                formatarNumero(ativos.length);

        }

        if ($("totalIndicacoes")) {

            $("totalIndicacoes").textContent =
                formatarNumero(totalIndicacoes);

        }

        if ($("totalPagas")) {

            $("totalPagas").textContent =
                formatarNumero(totalPagas);

        }

        if ($("taxaConversao")) {

            $("taxaConversao").textContent =
                `${conversao.toLocaleString("pt-BR", {
                    maximumFractionDigits: 1
                })}%`;

        }

    }


    /* =====================================================
       12. TABELA DE EMBAIXADORES
    ===================================================== */

    function renderizarTabela() {

        if (!lista) return;

        if (!embaixadores.length) {

            lista.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        Nenhum embaixador cadastrado.
                    </td>
                </tr>
            `;

            return;

        }

        lista.innerHTML = embaixadores.map(embaixador => {

            const indicacoes =
                obterIndicacoes(embaixador);

            const pagas =
                indicacoes.filter(statusPago);

            const ativo =
                statusAtivo(embaixador);

            const totalIndicacoes =
                inscricoesDisponiveis
                    ? formatarNumero(indicacoes.length)
                    : "—";

            const totalPagas =
                inscricoesDisponiveis
                    ? formatarNumero(pagas.length)
                    : "—";

            return `
                <tr>

                    <td>
                        <span class="ambassador-name">
                            ${escaparHTML(embaixador.nome)}
                        </span>

                        <br>

                        <small>
                            ${escaparHTML(
                                embaixador.instagram ||
                                embaixador.telefone ||
                                "Sem contato"
                            )}
                        </small>
                    </td>

                    <td>
                        <span class="ambassador-code">
                            ${escaparHTML(embaixador.codigo)}
                        </span>
                    </td>

                    <td>
                        ${totalIndicacoes}
                    </td>

                    <td>
                        <strong>
                            ${totalPagas}
                        </strong>
                    </td>

                    <td>
                        <span class="status-pill ${
                            ativo
                                ? "status-active"
                                : "status-inactive"
                        }">
                            ${ativo ? "Ativo" : "Inativo"}
                        </span>
                    </td>

                    <td>
                        <div class="table-actions">

                            <button
                                type="button"
                                data-action="link"
                                data-id="${escaparHTML(embaixador.id)}"
                            >
                                LINK
                            </button>

                            <button
                                type="button"
                                data-action="editar"
                                data-id="${escaparHTML(embaixador.id)}"
                            >
                                EDITAR
                            </button>

                            <button
                                type="button"
                                data-action="status"
                                data-id="${escaparHTML(embaixador.id)}"
                            >
                                ${ativo ? "DESATIVAR" : "ATIVAR"}
                            </button>

                        </div>
                    </td>

                </tr>
            `;

        }).join("");

    }


/* =====================================================
   13. RANKING
   CLASSIFICAÇÃO POR INSCRIÇÕES PAGAS
   COROA SOMENTE PARA O LÍDER COM PAGAMENTOS
===================================================== */

function renderizarRanking() {

    if (!ranking) return;

    if (!inscricoesDisponiveis) {

        ranking.innerHTML = `
            <div class="empty-state">
                Não foi possível consultar as inscrições para montar o ranking.
            </div>
        `;

        return;
    }

    if (!embaixadores.length) {

        ranking.innerHTML = `
            <div class="empty-state">
                Nenhum embaixador cadastrado.
            </div>
        `;

        return;
    }

    // Calcula indicações e pagamentos de cada embaixador.
    const resultados = embaixadores.map(embaixador => {

        const indicacoes = obterIndicacoes(embaixador);

        const pagas = indicacoes.filter(statusPago);

        return {
            ...embaixador,
            totalIndicacoes: indicacoes.length,
            totalPagas: pagas.length
        };

    });

    // Ordena primeiro por pagamentos confirmados.
    resultados.sort((a, b) => {

        if (b.totalPagas !== a.totalPagas) {
            return b.totalPagas - a.totalPagas;
        }

        if (b.totalIndicacoes !== a.totalIndicacoes) {
            return b.totalIndicacoes - a.totalIndicacoes;
        }

        return String(a.nome || "").localeCompare(
            String(b.nome || ""),
            "pt-BR"
        );

    });

    // Identifica o maior número de inscrições pagas.
    const maiorNumeroPagas = resultados[0].totalPagas;

    // Só existe líder com coroa quando há pelo menos um pagamento.
    const existeLider = maiorNumeroPagas > 0;

    ranking.innerHTML = resultados.map((item, index) => {

        const primeiroLugar =
            existeLider &&
            index === 0 &&
            item.totalPagas === maiorNumeroPagas;

        return `
            <div class="ranking-item ${
                primeiroLugar ? "ranking-first" : ""
            }">

                <div class="ranking-person">

                    <span class="ranking-number">
                        ${
                            primeiroLugar
                                ? "👑"
                                : String(index + 1).padStart(2, "0")
                        }
                    </span>

                    <div>

                        <strong>
                            ${escaparHTML(item.nome)}
                        </strong>

                        <small>
                            Código: ${escaparHTML(item.codigo)}
                            ${
                                !statusAtivo(item)
                                    ? " • Inativo"
                                    : ""
                            }
                        </small>

                    </div>

                </div>

                <div class="ranking-result">

                    <strong class="ranking-total">
                        ${formatarNumero(item.totalPagas)}
                    </strong>

                    <small>
                        ${
                            item.totalPagas === 1
                                ? "inscrição paga"
                                : "inscrições pagas"
                        }
                    </small>

                </div>

            </div>
        `;

    }).join("");

}


    /* =====================================================
       14. SELECT DE AÇÕES
       OPCIONAL: O HTML ATUAL NÃO POSSUI ESSE FORMULÁRIO
    ===================================================== */

    function preencherSelectAcoes() {

        const select = $("acaoEmbaixador");

        if (!select) return;

        const valorAtual = select.value;

        const ativos = embaixadores.filter(
            statusAtivo
        );

        select.innerHTML = `
            <option value="">
                Selecione um embaixador
            </option>

            ${ativos.map(item => `
                <option value="${escaparHTML(item.id)}">
                    ${escaparHTML(item.nome)}
                    — ${escaparHTML(item.codigo)}
                </option>
            `).join("")}
        `;

        if (
            ativos.some(
                item => String(item.id) === valorAtual
            )
        ) {

            select.value = valorAtual;

        }

    }


    /* =====================================================
       15. INTERPRETAR ERROS
    ===================================================== */

    function interpretarErro(erro) {

        const mensagemErro = String(
            erro?.message ||
            erro?.details ||
            erro ||
            ""
        );

        const mensagemMinuscula =
            mensagemErro.toLowerCase();

        if (
            erro?.code === "23505" ||
            mensagemMinuscula.includes("duplicate")
        ) {

            return "Esse código já está cadastrado. Escolha outro.";

        }

        if (
            erro?.code === "42501" ||
            mensagemMinuscula.includes("permission")
        ) {

            return "Acesso negado. Verifique as políticas RLS do Supabase.";

        }

        if (
            erro?.code === "42P01" ||
            mensagemMinuscula.includes("relation")
        ) {

            return "Tabela não encontrada. Confira o SQL do módulo Embaixadores.";

        }

        if (
            erro?.code === "42703" ||
            mensagemMinuscula.includes("column")
        ) {

            return "Uma coluna necessária não foi encontrada. Confira a estrutura SQL das tabelas.";

        }

        return mensagemErro ||
            "Não foi possível concluir a operação.";

    }


    /* =====================================================
       16. CADASTRAR / EDITAR EMBAIXADOR
    ===================================================== */

    if (form) {

        form.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                limparMensagem(mensagem);

                const id =
                    $("embaixadorId")?.value.trim();

                const nome =
                    $("nomeEmbaixador")?.value.trim();

                const telefone =
                    $("telefoneEmbaixador")?.value.trim();

                const instagram =
                    $("instagramEmbaixador")?.value.trim();

                const codigo =
                    normalizarCodigo(
                        $("codigoEmbaixador")?.value
                    );

                const status =
                    $("statusEmbaixador")?.value || "ATIVO";


                if (!nome || !codigo) {

                    mostrarMensagem(
                        mensagem,
                        "Preencha o nome e o código de identificação.",
                        "erro"
                    );

                    return;

                }


                if (!/^[A-Z0-9_-]{3,30}$/.test(codigo)) {

                    mostrarMensagem(
                        mensagem,
                        "O código deve ter de 3 a 30 caracteres, usando letras, números, hífen ou underline.",
                        "erro"
                    );

                    return;

                }


                const codigoDuplicado = embaixadores.some(item => {

                    return (
                        String(item.codigo).toUpperCase() === codigo &&
                        String(item.id) !== String(id)
                    );

                });


                if (codigoDuplicado) {

                    mostrarMensagem(
                        mensagem,
                        "Esse código já está sendo utilizado por outro embaixador.",
                        "erro"
                    );

                    return;

                }


                const dados = {

                    nome,

                    telefone: telefone || null,

                    instagram: instagram || null,

                    codigo,

                    status

                };


                const botao = form.querySelector(
                    '[type="submit"]'
                );

                const textoOriginal =
                    botao?.innerHTML;


                if (botao) {

                    botao.disabled = true;

                    botao.textContent = id
                        ? "SALVANDO ALTERAÇÕES..."
                        : "CADASTRANDO...";

                }


                try {

                    let resultado;

                    if (id) {

                        resultado = await supabaseClient
                            .from(TABLE_EMBAIXADORES)
                            .update(dados)
                            .eq("id", id);

                    } else {

                        resultado = await supabaseClient
                            .from(TABLE_EMBAIXADORES)
                            .insert([dados]);

                    }


                    if (resultado.error) {
                        throw resultado.error;
                    }


                    mostrarMensagem(
                        mensagem,
                        id
                            ? "Embaixador atualizado com sucesso!"
                            : "Embaixador cadastrado com sucesso!"
                    );


                    form.reset();

                    if ($("embaixadorId")) {
                        $("embaixadorId").value = "";
                    }

                    if ($("statusEmbaixador")) {
                        $("statusEmbaixador").value = "ATIVO";
                    }

                    if (linkCompartilhamento) {
                        linkCompartilhamento.value = "";
                    }

                    embaixadorSelecionado = null;

                    await carregarDados();

                } catch (erro) {

                    console.error(
                        "Erro ao salvar embaixador:",
                        erro
                    );

                    mostrarMensagem(
                        mensagem,
                        interpretarErro(erro),
                        "erro"
                    );

                } finally {

                    if (botao) {

                        botao.disabled = false;

                        botao.innerHTML =
                            textoOriginal || `
                                SALVAR EMBAIXADOR
                                <span>＋</span>
                            `;

                    }

                }

            }
        );

    }


    /* =====================================================
       17. AÇÕES DA TABELA
    ===================================================== */

    if (lista) {

        lista.addEventListener(
            "click",
            async event => {

                const botao = event.target.closest(
                    "button[data-action]"
                );

                if (!botao) return;

                const id = botao.dataset.id;

                const acao = botao.dataset.action;

                const embaixador = embaixadores.find(
                    item => String(item.id) === String(id)
                );

                if (!embaixador) return;


                /* -----------------------------------------
                   GERAR LINK
                ----------------------------------------- */

                if (acao === "link") {

                    embaixadorSelecionado = embaixador;

                    if (linkCompartilhamento) {

                        linkCompartilhamento.value =
                            gerarLink(embaixador.codigo);

                    }

                    mostrarMensagem(
                        mensagemLink,
                        `Link de ${embaixador.nome} selecionado.`
                    );

                    linkCompartilhamento?.scrollIntoView({
                        behavior: "smooth",
                        block: "center"
                    });

                    return;

                }


                /* -----------------------------------------
                   EDITAR
                ----------------------------------------- */

                if (acao === "editar") {

                    $("embaixadorId").value =
                        embaixador.id;

                    $("nomeEmbaixador").value =
                        embaixador.nome || "";

                    $("telefoneEmbaixador").value =
                        embaixador.telefone || "";

                    $("instagramEmbaixador").value =
                        embaixador.instagram || "";

                    $("codigoEmbaixador").value =
                        embaixador.codigo || "";

                    $("statusEmbaixador").value =
                        embaixador.status || "ATIVO";

                    mostrarMensagem(
                        mensagem,
                        "Editando cadastro. Altere os dados e salve."
                    );

                    $("novo-embaixador")?.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });

                    return;

                }


                /* -----------------------------------------
                   ATIVAR / DESATIVAR
                ----------------------------------------- */

                if (acao === "status") {

                    const estaAtivo =
                        statusAtivo(embaixador);

                    const novoStatus =
                        estaAtivo ? "INATIVO" : "ATIVO";

                    const confirmar = window.confirm(
                        `Deseja ${
                            estaAtivo ? "desativar" : "ativar"
                        } ${embaixador.nome}?`
                    );

                    if (!confirmar) return;

                    botao.disabled = true;

                    try {

                        const { error } = await supabaseClient
                            .from(TABLE_EMBAIXADORES)
                            .update({
                                status: novoStatus
                            })
                            .eq("id", id);

                        if (error) {
                            throw error;
                        }

                        mostrarMensagem(
                            mensagemLista,
                            `Embaixador ${
                                novoStatus === "ATIVO"
                                    ? "ativado"
                                    : "desativado"
                            } com sucesso.`
                        );

                        await carregarDados();

                    } catch (erro) {

                        console.error(
                            "Erro ao alterar status:",
                            erro
                        );

                        mostrarMensagem(
                            mensagemLista,
                            interpretarErro(erro),
                            "erro"
                        );

                    } finally {

                        botao.disabled = false;

                    }

                }

            }
        );

    }


    /* =====================================================
       18. COPIAR LINK
    ===================================================== */

    if (copiarLinkBtn) {

        copiarLinkBtn.addEventListener(
            "click",
            async () => {

                const link =
                    linkCompartilhamento?.value.trim();

                if (!link) {

                    mostrarMensagem(
                        mensagemLink,
                        "Selecione um embaixador na tabela primeiro.",
                        "aviso"
                    );

                    return;

                }


                try {

                    if (
                        navigator.clipboard &&
                        window.isSecureContext
                    ) {

                        await navigator.clipboard.writeText(link);

                    } else {

                        linkCompartilhamento.select();

                        const copiou =
                            document.execCommand("copy");

                        if (!copiou) {
                            throw new Error("Não foi possível copiar.");
                        }

                    }

                    mostrarMensagem(
                        mensagemLink,
                        "Link copiado! Já pode compartilhar."
                    );

                } catch (erro) {

                    console.error(
                        "Erro ao copiar link:",
                        erro
                    );

                    linkCompartilhamento?.select();

                    mostrarMensagem(
                        mensagemLink,
                        "Não foi possível copiar automaticamente. Selecione e copie o link.",
                        "erro"
                    );

                }

            }
        );

    }


    /* =====================================================
       19. LIMPAR FORMULÁRIO
    ===================================================== */

    if (limparFormulario) {

        limparFormulario.addEventListener(
            "click",
            () => {

                setTimeout(() => {

                    if ($("embaixadorId")) {
                        $("embaixadorId").value = "";
                    }

                    if ($("statusEmbaixador")) {
                        $("statusEmbaixador").value = "ATIVO";
                    }

                    limparMensagem(mensagem);

                }, 0);

            }
        );

    }


    /* =====================================================
       20. REGISTRAR AÇÃO
       OPCIONAL: SOMENTE SE O FORM EXISTIR NO HTML
    ===================================================== */

    if (formAcao) {

        formAcao.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                limparMensagem(mensagemAcao);

                const embaixadorId =
                    $("acaoEmbaixador")?.value;

                const tipo =
                    $("tipoAcao")?.value;

                const descricao =
                    $("descricaoAcao")?.value.trim();

                if (!embaixadorId || !tipo) {

                    mostrarMensagem(
                        mensagemAcao,
                        "Selecione o embaixador e o tipo de ação.",
                        "erro"
                    );

                    return;

                }


                const dados = {

                    embaixador_id: embaixadorId,

                    tipo_acao: tipo,

                    descricao: descricao || null

                };


                const botao = formAcao.querySelector(
                    '[type="submit"]'
                );

                if (botao) {

                    botao.disabled = true;

                    botao.textContent = "REGISTRANDO...";

                }


                try {

                    const { error } = await supabaseClient
                        .from(TABLE_ACOES)
                        .insert([dados]);

                    if (error) {
                        throw error;
                    }

                    mostrarMensagem(
                        mensagemAcao,
                        "Ação de divulgação registrada com sucesso!"
                    );

                    formAcao.reset();

                } catch (erro) {

                    console.error(
                        "Erro ao registrar ação:",
                        erro
                    );

                    mostrarMensagem(
                        mensagemAcao,
                        interpretarErro(erro),
                        "erro"
                    );

                } finally {

                    if (botao) {

                        botao.disabled = false;

                        botao.textContent =
                            "REGISTRAR AÇÃO";

                    }

                }

            }
        );

    }


    /* =====================================================
       21. SAIR DO SISTEMA
    ===================================================== */

    if (logoutBtn) {

        logoutBtn.addEventListener(
            "click",
            async () => {

                const confirmar = window.confirm(
                    "Deseja realmente sair do sistema?"
                );

                if (!confirmar) return;

                try {

                    if (
                        !supabaseClient.auth ||
                        typeof supabaseClient.auth.signOut !== "function"
                    ) {

                        throw new Error(
                            "Autenticação do Supabase não encontrada."
                        );

                    }

                    const { error } =
                        await supabaseClient.auth.signOut();

                    if (error) {
                        throw error;
                    }

                    window.location.href = "login.html";

                } catch (erro) {

                    console.error(
                        "Erro ao sair:",
                        erro
                    );

                    mostrarMensagem(
                        mensagemLista,
                        "Não foi possível encerrar a sessão. Tente novamente.",
                        "erro"
                    );

                }

            }
        );

    }


    /* =====================================================
       22. INICIALIZAÇÃO
    ===================================================== */

    carregarDados();

});
