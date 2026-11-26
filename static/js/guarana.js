// ================================================================================
// ARQUIVO BASE DE Guaraná
// NÃO ALTERE! ELE É GERADO AUTOMATICAMENTE E TUDO SE PERDE AO ATUALIZAR
// FAÇA SUAS INCLUSÕES E USOS DESSAS FUNÇÕES EM OUTRO ARQUIVO
// --------------------------------------------------------------------------------
// Versão: 1.0.0
// Última alteração nesse sistema em: 26/11/2026
// ================================================================================


// Base para a aplicação e remoção de tema. O tema é aplicado ou removido
// diretamente no <html>
// -----------------------------------------------------------------------------
function guaRemoverTemas() {
    let body = document.documentElement

    body.classList.forEach(temas => {
        if (temas.startsWith('tema')) {
            body.classList.remove(temas)
        }
    })
}
function guaAplicarTema(tema) {
    guaRemoverTemas()
    let body = document.documentElement
    body.classList.add(tema)
}

// Busca pelos elementos que contenham a classe escolhida e retira a classe
// `ativo` (ou uma variação passada no segundo parâmetro) em todos os itens
// com a classe, inserindo o `ativo` no item clicado
// -----------------------------------------------------------------------------
function guaAtivarDesativar(classe, classe_ativa="ativo") {
    let todos_itens = document.querySelectorAll(`.${classe}`)
    
    if (todos_itens.length > 0) {
        todos_itens.forEach(item => {
            item.addEventListener('click', () => {
                // retirar o item atual (se tiver)
                let ativo_atual = document.querySelector(`.${classe}.${classe_ativa}`)
                if (ativo_atual) {
                    ativo_atual.classList.remove(classe_ativa)
                }
                
                item.classList.add(classe_ativa)
            })
        })
    }
}


// Ativação e desativação de Abas
// -----------------------------------------------------------------------------
function guaAtivarDesativarAbas(classe="abas", ativo="ativo", atributo="data-aba") {
    let nav = `${classe}__item`
    let conteudo = `${classe}__conteudo`

    let todos_nav = document.querySelectorAll(`.${nav}`)
    let todos_conteudo = document.querySelectorAll(`.${conteudo}`)

    if (todos_nav.length != todos_conteudo.length) {
        console.log(`Existem ${todos_nav.length} links de aba e ${todos_conteudo.length} conteúdos de aba`)
        return
    }

    if (todos_conteudo.length > 0) {
        todos_nav.forEach(item => {
            let id_href = item.getAttribute(atributo).replace('#', '')
            let aba_atual = document.getElementById(id_href)
            
            item.addEventListener('click', () => {
                // retira classes ativas
                let nav_ativo_atual = document.querySelector(`.${nav}.${ativo}`)
                if (nav_ativo_atual) {
                    nav_ativo_atual.classList.remove(ativo)
                }

                let nav_conteudo_atual = document.querySelector(`.${conteudo}.${ativo}`)
                if (nav_conteudo_atual) {
                    nav_conteudo_atual.classList.remove(ativo)
                }
    
                // aplica classes ativa
                item.classList.add(ativo)
                aba_atual.classList.add(ativo)
            })
        })
    }

}

// Gera autocomplete
// -----------------------------------------------------------------------------
function guaGeraAutocomplete(id, itens, tem_erro=false) {
    let campo = document.getElementById(id)
    let paiCampo = campo.parentElement
    let msgErro = paiCampo.querySelector('.campo__erro')
    let containerAutocomplete = paiCampo.querySelector('.autocomplete')

    if (!msgErro) {
        msgErro = document.createElement('span')
        msgErro.classList.add('campo__erro')
        paiCampo.appendChild(msgErro)
    }

    if (!containerAutocomplete) {
        containerAutocomplete = document.createElement('nav')
        containerAutocomplete.classList.add('autocomplete')
        paiCampo.appendChild(containerAutocomplete)
    }

    const minChars = itens.length > 100 ? 3 : 1
    let indiceSelecionado = -1

    function atualizarDestaque() {
        const spans = containerAutocomplete.querySelectorAll('.autocomplete__item')
        spans.forEach((span, i) => {
            span.classList.toggle('ativo', i === indiceSelecionado)
        })
    }

    function escreveSugestoes(texto) {
        containerAutocomplete.innerHTML = ''
        indiceSelecionado = -1

        if (texto.length < minChars) return

        const filtrados = itens.filter(item =>
            item.toLowerCase().includes(texto.toLowerCase())
        )

        filtrados.forEach(item => {
            const span = document.createElement('span')
            span.classList.add('autocomplete__item')
            span.textContent = item

            span.addEventListener('mousedown', () => {
                campo.value = item
                containerAutocomplete.innerHTML = ''
                msgErro.textContent = ''
                indiceSelecionado = -1
            })

            containerAutocomplete.appendChild(span)
        })
    }

    campo.addEventListener('input', () => {
        escreveSugestoes(campo.value)
    })

    campo.addEventListener('keydown', (e) => {
        const spans = containerAutocomplete.querySelectorAll('.autocomplete__item')
        if (!spans.length) return

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            indiceSelecionado = (indiceSelecionado + 1) % spans.length
            atualizarDestaque()
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            indiceSelecionado = (indiceSelecionado - 1 + spans.length) % spans.length
            atualizarDestaque()
        } else if (e.key === 'Enter' && indiceSelecionado >= 0) {
            e.preventDefault()
            campo.value = spans[indiceSelecionado].textContent
            containerAutocomplete.innerHTML = ''
            msgErro.textContent = ''
            indiceSelecionado = -1
        } else if (e.key === 'Escape') {
            containerAutocomplete.innerHTML = ''
            indiceSelecionado = -1
        }
    })

    campo.addEventListener('blur', () => {
        const valor = campo.value.trim()

        setTimeout(() => {
            containerAutocomplete.innerHTML = ''
            indiceSelecionado = -1
        }, 150)

        if (!tem_erro) return

        if (valor && !itens.includes(valor)) {
            msgErro.innerHTML = `<em>${valor}</em> não é válido`
            paiCampo.classList.add('campo--invalido')
        } else {
            msgErro.textContent = ''
            paiCampo.classList.remove('campo--invalido')
        }
    })

    campo.addEventListener('focus', () => {
        msgErro.textContent = ''
        escreveSugestoes(campo.value)
    })
}