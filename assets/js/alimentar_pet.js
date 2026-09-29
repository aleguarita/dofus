(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Dados (RECURSOS_DATA e XP_DATA vêm de recursos_data.js e xp_data.js)
  // ---------------------------------------------------------------------
  var RECURSOS = RECURSOS_DATA;
  var XP_TABLE = XP_DATA;
  var RECURSOS_BY_ID = new Map(RECURSOS.map(function (r) { return [r.id, r]; }));

  var racaoRef = RECURSOS.filter(function (r) { return r.pt === 'Ração Vitaminada'; })[0];
  var RACAO_ID = racaoRef.id;
  var RACAO_XP = racaoRef.xp;

  var PAGE_SIZE = 100;
  var STORAGE_KEY = 'dofusAlimentosPets_v1';

  // ---------------------------------------------------------------------
  // Estado
  // ---------------------------------------------------------------------
  function defaultState() {
    return {
      idioma: 'pt',
      precoKoli: 0,
      precoPepitas: 0,
      xpAtual: 0,
      nivelDesejado: 100,
      porcentagemAlmejada: 50,
      recursoEscolhidoId: RACAO_ID,
      prices: {},
      favoritos: {},
      filtroDraft: { nome: '', almejado: false, favoritos: false },
      filtroAtivo: { nome: '', almejado: false, favoritos: false },
      sort: { field: 'nome', dir: 'asc' },
      page: 1
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      var base = defaultState();
      // merge raso garantindo que campos novos não fiquem undefined
      for (var k in base) {
        if (parsed[k] === undefined) parsed[k] = base[k];
      }
      parsed.filtroDraft = parsed.filtroDraft || base.filtroDraft;
      parsed.filtroAtivo = parsed.filtroAtivo || base.filtroAtivo;
      parsed.sort = parsed.sort || base.sort;
      parsed.prices = parsed.prices || {};
      parsed.favoritos = parsed.favoritos || {};
      return parsed;
    } catch (e) {
      return defaultState();
    }
  }

  var state = loadState();

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // localStorage indisponível — ignora silenciosamente
    }
  }

  // ---------------------------------------------------------------------
  // Helpers de formatação
  // ---------------------------------------------------------------------
  function fmt(n, decimals) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: decimals === undefined ? 2 : decimals });
  }
  function fmtInt(n) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    return Math.trunc(n).toLocaleString('pt-BR');
  }
  function getPrice(id) {
    return state.prices[id] || 0;
  }
  function nomeRecurso(r) {
    return state.idioma === 'pt' ? r.pt : r.en;
  }

  // ---------------------------------------------------------------------
  // Cálculos — Card Preço base
  // ---------------------------------------------------------------------
  function koliParaRacao() {
    return state.precoKoli > 0 ? state.precoKoli / 10 : 0;
  }
  function pepitaParaRacao() {
    return state.precoPepitas > 0 ? state.precoPepitas * 5 : 0;
  }
  function racaoDireto() {
    return getPrice(RACAO_ID);
  }
  function calcRacaoPrecoBase() {
    var candidatos = [
      { key: 'direto', val: racaoDireto() },
      { key: 'koli', val: koliParaRacao() },
      { key: 'pepita', val: pepitaParaRacao() }
    ].filter(function (c) { return c.val > 0; });
    if (candidatos.length === 0) return { value: 0, best: null };
    var melhor = candidatos.reduce(function (a, b) { return b.val < a.val ? b : a; });
    return { value: melhor.val, best: melhor.key };
  }
  function precoBase() {
    var rb = calcRacaoPrecoBase().value;
    return RACAO_XP > 0 ? rb / RACAO_XP : 0;
  }

  // ---------------------------------------------------------------------
  // Cálculos — Card XP
  // ---------------------------------------------------------------------
  function nivelAtual(xp) {
    var lvl = 0;
    for (var i = 0; i < XP_TABLE.length; i++) {
      if (XP_TABLE[i].xp <= xp) lvl = XP_TABLE[i].lvl;
      else break;
    }
    return lvl;
  }
  function xpParaNivel(lvl) {
    for (var i = 0; i < XP_TABLE.length; i++) {
      if (XP_TABLE[i].lvl === lvl) return XP_TABLE[i].xp;
    }
    if (lvl <= 0) return 0;
    return XP_TABLE[XP_TABLE.length - 1].xp;
  }
  function xpFaltando() {
    var alvo = xpParaNivel(state.nivelDesejado);
    return Math.max(0, alvo - state.xpAtual);
  }

  // ---------------------------------------------------------------------
  // Cálculos por recurso
  // ---------------------------------------------------------------------
  function qtdNecessaria(r) {
    if (!r || r.xp <= 0) return 0;
    return Math.ceil(xpFaltando() / r.xp);
  }
  function precoEfetivo(r) {
    if (r.id === RACAO_ID) {
      var rb = calcRacaoPrecoBase().value;
      if (rb > 0) return rb;
    }
    return getPrice(r.id);
  }
  function precoEstimadoTotal(r) {
    return qtdNecessaria(r) * precoEfetivo(r);
  }
  function porcentagemRecurso(r) {
    var pb = precoBase();
    if (pb <= 0 || r.xp <= 0) return null;
    var precoPorXp = precoEfetivo(r) / r.xp;
    return (precoPorXp / pb) * 100;
  }
  function almejadoValores(r) {
    var pb = precoBase();
    var alvoPorXp = pb * (state.porcentagemAlmejada / 100);
    var unidade = alvoPorXp * r.xp;
    return {
      x1: Math.floor(unidade * 1),
      x10: Math.floor(unidade * 10),
      x100: Math.floor(unidade * 100),
      x1000: Math.floor(unidade * 1000)
    };
  }

  // ---------------------------------------------------------------------
  // DOM refs
  // ---------------------------------------------------------------------
  var el = {
    idiomaSelect: document.getElementById('idioma-select'),

    inputPrecoRacao: document.getElementById('input-preco-racao'),
    inputPrecoKoli: document.getElementById('input-preco-koli'),
    inputPrecoPepitas: document.getElementById('input-preco-pepitas'),
    valorKoliParaRacao: document.getElementById('valor-koli-para-racao'),
    valorPepitaParaRacao: document.getElementById('valor-pepita-para-racao'),
    valorRacaoPrecoBase: document.getElementById('valor-racao-preco-base'),
    valorPrecoBase: document.getElementById('valor-preco-base'),

    inputXpAtual: document.getElementById('input-xp-atual'),
    inputNivelDesejado: document.getElementById('input-nivel-desejado'),
    labelNivelX: document.getElementById('label-nivel-x'),
    valorNivelAtual: document.getElementById('valor-nivel-atual'),
    valorXpParaNivel: document.getElementById('valor-xp-para-nivel'),
    valorXpFaltando: document.getElementById('valor-xp-faltando'),

    inputEscolhaRecurso: document.getElementById('input-escolha-recurso'),
    escolhaSugestoes: document.getElementById('escolha-recurso-sugestoes'),
    valorEscolhaQtd: document.getElementById('valor-escolha-qtd'),
    inputEscolhaPreco: document.getElementById('input-escolha-preco'),
    valorEscolhaEstimado: document.getElementById('valor-escolha-estimado'),

    inputPorcentagemAlmejada: document.getElementById('input-porcentagem-almejada'),

    filtroNome: document.getElementById('filtro-nome'),
    filtroAlmejado: document.getElementById('filtro-almejado'),
    filtroFavoritos: document.getElementById('filtro-favoritos'),
    btnFiltrar: document.getElementById('btn-filtrar'),
    btnLimparFiltro: document.getElementById('btn-limpar-filtro'),

    sortField: document.getElementById('sort-field'),
    sortDirBtn: document.getElementById('sort-dir-btn'),
    contagemResultados: document.getElementById('contagem-resultados'),

    tabelaBody: document.getElementById('tabela-body'),
    pagAnterior: document.getElementById('pag-anterior'),
    pagProxima: document.getElementById('pag-proxima'),
    pagInfo: document.getElementById('pag-info')
  };

  el.inputPrecoRacao.dataset.priceId = String(RACAO_ID);

  // ---------------------------------------------------------------------
  // Autocomplete de recursos (nome -> id, conforme idioma)
  // ---------------------------------------------------------------------
  var nomeParaId = new Map();
  var sugestaoAtivaIdx = -1;
  var LIMITE_SUGESTOES = 40;

  function reconstruirIndiceNomes() {
    nomeParaId.clear();
    for (var i = 0; i < RECURSOS.length; i++) {
      nomeParaId.set(nomeRecurso(RECURSOS[i]), RECURSOS[i].id);
    }
  }

  function esconderSugestoes() {
    el.escolhaSugestoes.classList.remove('aberta');
    el.escolhaSugestoes.innerHTML = '';
    sugestaoAtivaIdx = -1;
  }

  function mostrarSugestoes(termo) {
    var termoLower = termo.trim().toLowerCase();
    var lista;
    if (!termoLower) {
      lista = RECURSOS.slice(0, LIMITE_SUGESTOES);
    } else {
      lista = RECURSOS.filter(function (r) {
        return nomeRecurso(r).toLowerCase().indexOf(termoLower) !== -1;
      }).slice(0, LIMITE_SUGESTOES);
    }

    sugestaoAtivaIdx = -1;
    if (lista.length === 0) {
      el.escolhaSugestoes.innerHTML = '<li class="vazio">Nenhum recurso encontrado</li>';
      el.escolhaSugestoes.classList.add('aberta');
      return;
    }

    var html = [];
    for (var i = 0; i < lista.length; i++) {
      html.push('<li data-id="' + lista[i].id + '">' + escapeHtml(nomeRecurso(lista[i])) + '</li>');
    }
    el.escolhaSugestoes.innerHTML = html.join('');
    el.escolhaSugestoes.classList.add('aberta');
  }

  function escolherRecurso(id) {
    var r = RECURSOS_BY_ID.get(id);
    if (!r) return;
    state.recursoEscolhidoId = id;
    persist();
    esconderSugestoes();
    renderCardEscolha();
    atualizarCelulasCalculadasVisiveis();
  }

  function destacarSugestao(novoIdx) {
    var itens = el.escolhaSugestoes.querySelectorAll('li[data-id]');
    if (itens.length === 0) return;
    if (novoIdx < 0) novoIdx = itens.length - 1;
    if (novoIdx >= itens.length) novoIdx = 0;
    itens.forEach(function (li) { li.classList.remove('ativa'); });
    itens[novoIdx].classList.add('ativa');
    itens[novoIdx].scrollIntoView({ block: 'nearest' });
    sugestaoAtivaIdx = novoIdx;
  }

  // ---------------------------------------------------------------------
  // Render — Card Preço base
  // ---------------------------------------------------------------------
  function renderCardPrecoBase() {
    var koli = koliParaRacao();
    var pepita = pepitaParaRacao();
    el.valorKoliParaRacao.textContent = koli > 0 ? fmt(koli, 2) : '-';
    el.valorPepitaParaRacao.textContent = pepita > 0 ? fmt(pepita, 2) : '-';

    var rb = calcRacaoPrecoBase();
    el.valorRacaoPrecoBase.textContent = rb.value > 0 ? fmt(rb.value, 2) : '-';
    el.valorPrecoBase.textContent = precoBase() > 0 ? fmt(precoBase(), 4) : '-';

    el.inputPrecoRacao.classList.toggle('melhor-valor', rb.best === 'direto');
    el.inputPrecoKoli.classList.toggle('melhor-valor', rb.best === 'koli');
    el.inputPrecoPepitas.classList.toggle('melhor-valor', rb.best === 'pepita');
  }

  // ---------------------------------------------------------------------
  // Render — Card XP
  // ---------------------------------------------------------------------
  function renderCardXP() {
    var atual = nivelAtual(state.xpAtual);
    var xpNivel = xpParaNivel(state.nivelDesejado);
    var faltando = xpFaltando();

    el.valorNivelAtual.textContent = fmtInt(atual);
    el.labelNivelX.textContent = fmtInt(state.nivelDesejado);
    el.valorXpParaNivel.textContent = fmtInt(xpNivel);
    el.valorXpFaltando.textContent = fmtInt(faltando);
  }

  // ---------------------------------------------------------------------
  // Render — Card Escolha de recurso
  // ---------------------------------------------------------------------
  function renderCardEscolha() {
    var r = RECURSOS_BY_ID.get(state.recursoEscolhidoId) || racaoRef;
    el.inputEscolhaRecurso.value = nomeRecurso(r);
    el.inputEscolhaPreco.dataset.priceId = String(r.id);
    el.inputEscolhaPreco.value = getPrice(r.id) || '';

    el.valorEscolhaQtd.textContent = fmtInt(qtdNecessaria(r));
    el.valorEscolhaEstimado.textContent = fmt(precoEstimadoTotal(r), 2);
  }

  // ---------------------------------------------------------------------
  // Filtro + ordenação
  // ---------------------------------------------------------------------
  function listaFiltradaOrdenada() {
    var f = state.filtroAtivo;
    var lista = RECURSOS;

    if (f.nome) {
      var termo = f.nome.toLowerCase();
      lista = lista.filter(function (r) {
        return nomeRecurso(r).toLowerCase().indexOf(termo) !== -1;
      });
    }
    if (f.favoritos) {
      lista = lista.filter(function (r) { return !!state.favoritos[r.id]; });
    }
    if (f.almejado) {
      lista = lista.filter(function (r) {
        var p = porcentagemRecurso(r);
        return p !== null && p <= state.porcentagemAlmejada;
      });
    }

    var dir = state.sort.dir === 'asc' ? 1 : -1;
    var campo = state.sort.field;
    lista = lista.slice().sort(function (a, b) {
      var va, vb;
      if (campo === 'qtd') { va = qtdNecessaria(a); vb = qtdNecessaria(b); }
      else if (campo === 'preco') { va = getPrice(a.id); vb = getPrice(b.id); }
      else if (campo === 'estimado') { va = precoEstimadoTotal(a); vb = precoEstimadoTotal(b); }
      else { va = nomeRecurso(a).toLowerCase(); vb = nomeRecurso(b).toLowerCase(); }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });

    return lista;
  }

  // ---------------------------------------------------------------------
  // Render — Tabela (com paginação)
  // ---------------------------------------------------------------------
  function renderTabela() {
    var lista = listaFiltradaOrdenada();
    var totalPaginas = Math.max(1, Math.ceil(lista.length / PAGE_SIZE));
    if (state.page > totalPaginas) state.page = totalPaginas;
    if (state.page < 1) state.page = 1;

    var inicio = (state.page - 1) * PAGE_SIZE;
    var pagina = lista.slice(inicio, inicio + PAGE_SIZE);

    var html = [];
    for (var i = 0; i < pagina.length; i++) {
      var r = pagina[i];
      var qtd = qtdNecessaria(r);
      var pct = porcentagemRecurso(r);
      var estimado = precoEstimadoTotal(r);
      var alm = almejadoValores(r);
      var preco = getPrice(r.id);
      var fav = !!state.favoritos[r.id];

      html.push(
        '<tr data-id="' + r.id + '">' +
        '<td>' + escapeHtml(nomeRecurso(r)) + '</td>' +
        '<td>' + fmt(r.xp, 4) + '</td>' +
        '<td class="cell-qtd">' + fmtInt(qtd) + '</td>' +
        '<td><input type="number" min="0" step="0.01" class="preco-input" data-price-id="' + r.id + '" value="' + (preco || '') + '"></td>' +
        '<td class="cell-pct">' + (pct === null ? '-' : fmt(pct, 2) + '%') + '</td>' +
        '<td class="cell-estimado">' + fmt(estimado, 2) + '</td>' +
        '<td class="cell-x1">' + fmtInt(alm.x1) + '</td>' +
        '<td class="cell-x10">' + fmtInt(alm.x10) + '</td>' +
        '<td class="cell-x100">' + fmtInt(alm.x100) + '</td>' +
        '<td class="cell-x1000">' + fmtInt(alm.x1000) + '</td>' +
        '<td class="fav-cell"><input type="checkbox" class="fav-checkbox" data-id="' + r.id + '"' + (fav ? ' checked' : '') + '></td>' +
        '</tr>'
      );
    }
    el.tabelaBody.innerHTML = html.join('');

    el.pagInfo.textContent = 'Página ' + state.page + ' de ' + totalPaginas;
    el.pagAnterior.disabled = state.page <= 1;
    el.pagProxima.disabled = state.page >= totalPaginas;
    el.contagemResultados.textContent = lista.length.toLocaleString('pt-BR') + ' recurso(s)';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Atualiza apenas as células calculadas das linhas já renderizadas,
  // sem reconstruir a tabela inteira (preserva foco e posição do cursor).
  function atualizarCelulasCalculadasVisiveis() {
    var linhas = el.tabelaBody.querySelectorAll('tr');
    for (var i = 0; i < linhas.length; i++) {
      var tr = linhas[i];
      var id = Number(tr.dataset.id);
      var r = RECURSOS_BY_ID.get(id);
      if (!r) continue;
      var qtd = qtdNecessaria(r);
      var pct = porcentagemRecurso(r);
      var estimado = precoEstimadoTotal(r);
      var alm = almejadoValores(r);

      tr.querySelector('.cell-qtd').textContent = fmtInt(qtd);
      tr.querySelector('.cell-pct').textContent = (pct === null ? '-' : fmt(pct, 2) + '%');
      tr.querySelector('.cell-estimado').textContent = fmt(estimado, 2);
      tr.querySelector('.cell-x1').textContent = fmtInt(alm.x1);
      tr.querySelector('.cell-x10').textContent = fmtInt(alm.x10);
      tr.querySelector('.cell-x100').textContent = fmtInt(alm.x100);
      tr.querySelector('.cell-x1000').textContent = fmtInt(alm.x1000);
    }
  }

  // ---------------------------------------------------------------------
  // Atualização geral após qualquer mudança que afete cálculos
  // ---------------------------------------------------------------------
  function atualizarTudoCalculado() {
    renderCardPrecoBase();
    renderCardXP();
    renderCardEscolha();
    atualizarCelulasCalculadasVisiveis();
  }

  // ---------------------------------------------------------------------
  // Preço compartilhado (sincroniza todos os campos com o mesmo data-price-id)
  // ---------------------------------------------------------------------
  function setPrice(id, rawValue, sourceEl) {
    var num = rawValue === '' ? 0 : (parseFloat(rawValue) || 0);
    state.prices[id] = num;
    persist();
    var seletor = '[data-price-id="' + id + '"]';
    var elementos = document.querySelectorAll(seletor);
    for (var i = 0; i < elementos.length; i++) {
      if (elementos[i] !== sourceEl) elementos[i].value = rawValue;
    }
    atualizarTudoCalculado();
  }

  // ---------------------------------------------------------------------
  // Listeners
  // ---------------------------------------------------------------------

  // Idioma
  el.idiomaSelect.addEventListener('change', function () {
    state.idioma = el.idiomaSelect.value;
    persist();
    reconstruirIndiceNomes();
    renderCardEscolha();
    renderTabela();
  });

  // Preços com data-price-id (delegação global)
  document.addEventListener('input', function (e) {
    if (e.target.matches && e.target.matches('[data-price-id]')) {
      var id = Number(e.target.dataset.priceId);
      setPrice(id, e.target.value, e.target);
    }
  });

  // Koli / Pepitas
  el.inputPrecoKoli.addEventListener('input', function () {
    state.precoKoli = parseFloat(el.inputPrecoKoli.value) || 0;
    persist();
    atualizarTudoCalculado();
  });
  el.inputPrecoPepitas.addEventListener('input', function () {
    state.precoPepitas = parseFloat(el.inputPrecoPepitas.value) || 0;
    persist();
    atualizarTudoCalculado();
  });

  // XP
  el.inputXpAtual.addEventListener('input', function () {
    state.xpAtual = parseFloat(el.inputXpAtual.value) || 0;
    persist();
    atualizarTudoCalculado();
  });
  el.inputNivelDesejado.addEventListener('input', function () {
    var v = parseInt(el.inputNivelDesejado.value, 10);
    if (isNaN(v)) v = 100;
    if (v < 1) v = 1;
    if (v > 100) v = 100;
    state.nivelDesejado = v;
    persist();
    atualizarTudoCalculado();
  });

  // Escolha de recurso (autocomplete customizado)
  el.inputEscolhaRecurso.addEventListener('focus', function () {
    mostrarSugestoes(el.inputEscolhaRecurso.value);
  });
  el.inputEscolhaRecurso.addEventListener('input', function () {
    mostrarSugestoes(el.inputEscolhaRecurso.value);
  });
  el.inputEscolhaRecurso.addEventListener('keydown', function (e) {
    var itens = el.escolhaSugestoes.querySelectorAll('li[data-id]');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!el.escolhaSugestoes.classList.contains('aberta')) mostrarSugestoes(el.inputEscolhaRecurso.value);
      destacarSugestao(sugestaoAtivaIdx + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      destacarSugestao(sugestaoAtivaIdx - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (itens.length > 0) {
        var idx = sugestaoAtivaIdx >= 0 ? sugestaoAtivaIdx : 0;
        escolherRecurso(Number(itens[idx].dataset.id));
      } else if (nomeParaId.has(el.inputEscolhaRecurso.value)) {
        escolherRecurso(nomeParaId.get(el.inputEscolhaRecurso.value));
      }
    } else if (e.key === 'Escape') {
      esconderSugestoes();
    }
  });
  el.inputEscolhaRecurso.addEventListener('blur', function () {
    // pequeno atraso para permitir que o "mousedown" na sugestão seja processado antes
    setTimeout(function () {
      esconderSugestoes();
      // se o texto não corresponde a um recurso válido, volta a exibir o recurso atualmente selecionado
      if (!nomeParaId.has(el.inputEscolhaRecurso.value)) {
        renderCardEscolha();
      }
    }, 150);
  });
  el.escolhaSugestoes.addEventListener('mousedown', function (e) {
    var li = e.target.closest ? e.target.closest('li[data-id]') : null;
    if (!li) return;
    e.preventDefault();
    escolherRecurso(Number(li.dataset.id));
  });

  // Porcentagem almejada
  el.inputPorcentagemAlmejada.addEventListener('input', function () {
    var v = parseFloat(el.inputPorcentagemAlmejada.value);
    if (isNaN(v)) v = 50;
    if (v < 0) v = 0;
    if (v > 100) {
      v = 100;
      el.inputPorcentagemAlmejada.value = 100;
    }
    state.porcentagemAlmejada = v;
    persist();
    atualizarTudoCalculado();
  });

  // Botões de reset
  document.querySelectorAll('.btn-reset').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var tipo = btn.dataset.reset;
      if (tipo === 'preco-racao') {
        setPrice(RACAO_ID, '', null);
        el.inputPrecoRacao.value = '';
      } else if (tipo === 'preco-koli') {
        state.precoKoli = 0;
        el.inputPrecoKoli.value = '';
        persist();
        atualizarTudoCalculado();
      } else if (tipo === 'preco-pepitas') {
        state.precoPepitas = 0;
        el.inputPrecoPepitas.value = '';
        persist();
        atualizarTudoCalculado();
      } else if (tipo === 'xp-atual') {
        state.xpAtual = 0;
        el.inputXpAtual.value = 0;
        persist();
        atualizarTudoCalculado();
      } else if (tipo === 'nivel-desejado') {
        state.nivelDesejado = 100;
        el.inputNivelDesejado.value = 100;
        persist();
        atualizarTudoCalculado();
      } else if (tipo === 'escolha-recurso') {
        state.recursoEscolhidoId = RACAO_ID;
        persist();
        renderCardEscolha();
        atualizarCelulasCalculadasVisiveis();
      } else if (tipo === 'porcentagem-almejada') {
        state.porcentagemAlmejada = 50;
        el.inputPorcentagemAlmejada.value = 50;
        persist();
        atualizarTudoCalculado();
      }
    });
  });

  // Checkbox de favorito (delegação na tbody)
  el.tabelaBody.addEventListener('change', function (e) {
    if (e.target.classList.contains('fav-checkbox')) {
      var id = Number(e.target.dataset.id);
      if (e.target.checked) state.favoritos[id] = true;
      else delete state.favoritos[id];
      persist();
    }
  });

  // Filtros
  el.btnFiltrar.addEventListener('click', function () {
    state.filtroAtivo = {
      nome: el.filtroNome.value.trim(),
      almejado: el.filtroAlmejado.checked,
      favoritos: el.filtroFavoritos.checked
    };
    state.filtroDraft = Object.assign({}, state.filtroAtivo);
    state.page = 1;
    persist();
    renderTabela();
  });
  el.btnLimparFiltro.addEventListener('click', function () {
    el.filtroNome.value = '';
    el.filtroAlmejado.checked = false;
    el.filtroFavoritos.checked = false;
    state.filtroDraft = { nome: '', almejado: false, favoritos: false };
    state.filtroAtivo = { nome: '', almejado: false, favoritos: false };
    state.page = 1;
    persist();
    renderTabela();
  });

  // Ordenação
  el.sortField.addEventListener('change', function () {
    state.sort.field = el.sortField.value;
    persist();
    renderTabela();
  });
  el.sortDirBtn.addEventListener('click', function () {
    state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
    el.sortDirBtn.textContent = state.sort.dir === 'asc' ? '▲ Crescente' : '▼ Decrescente';
    persist();
    renderTabela();
  });

  // Paginação
  el.pagAnterior.addEventListener('click', function () {
    if (state.page > 1) {
      state.page--;
      persist();
      renderTabela();
    }
  });
  el.pagProxima.addEventListener('click', function () {
    state.page++;
    persist();
    renderTabela();
  });

  // ---------------------------------------------------------------------
  // Inicialização
  // ---------------------------------------------------------------------
  function init() {
    el.idiomaSelect.value = state.idioma;
    el.inputPrecoRacao.value = getPrice(RACAO_ID) || '';
    el.inputPrecoKoli.value = state.precoKoli || '';
    el.inputPrecoPepitas.value = state.precoPepitas || '';
    el.inputXpAtual.value = state.xpAtual || 0;
    el.inputNivelDesejado.value = state.nivelDesejado || 100;
    el.inputPorcentagemAlmejada.value = state.porcentagemAlmejada;

    el.filtroNome.value = state.filtroDraft.nome || '';
    el.filtroAlmejado.checked = !!state.filtroDraft.almejado;
    el.filtroFavoritos.checked = !!state.filtroDraft.favoritos;

    el.sortField.value = state.sort.field;
    el.sortDirBtn.textContent = state.sort.dir === 'asc' ? '▲ Crescente' : '▼ Decrescente';

    reconstruirIndiceNomes();
    renderCardPrecoBase();
    renderCardXP();
    renderCardEscolha();
    renderTabela();
  }

  init();
})();
