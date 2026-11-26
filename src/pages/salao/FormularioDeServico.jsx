import { useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { Plus, Ruler, Trash2 } from 'lucide-react'
import Botao from '../../components/Botao.jsx'
import CampoTexto from '../../components/CampoTexto.jsx'
import Card from '../../components/Card.jsx'
import CardServico from '../../components/CardServico.jsx'
import Chip from '../../components/Chip.jsx'
import Dialogo from '../../components/Dialogo.jsx'
import Esqueleto from '../../components/Esqueleto.jsx'
import MensagemErro from '../../components/MensagemErro.jsx'
import OpcaoDeEscolha from '../../components/OpcaoDeEscolha.jsx'
import RodapeFixo from '../../components/RodapeFixo.jsx'
import {
  apagarServico,
  buscarServicoDoSalao,
  listarProfissionaisAtivos,
  listarServicosDoSalao,
  salvarServico,
} from '../../data/consultas.js'
import { formatarDuracao, formatarPreco } from '../../utils/formatos.js'
import {
  duracoesRapidas,
  errosDoServico,
  lerMinutos,
  lerPreco,
  limiteDeVariacoes,
  tamanhosPadrao,
  temErros,
  textoDoPreco,
} from '../../utils/servico.js'
import { profissionalLogado } from '../../utils/sessao.js'

const tiposDePreco = [
  { valor: 'fixo', titulo: 'Fixo', explicacao: 'O cliente vê o valor exato.' },
  { valor: 'a_partir', titulo: 'A partir de', explicacao: 'O valor pode subir depois de avaliar o cabelo.' },
  { valor: 'consulta', titulo: 'Sob consulta', explicacao: 'O preço não aparece; é combinado no salão.' },
]

function formularioVazio(idLogado) {
  return {
    nome: '',
    categoria: '',
    novaCategoria: '',
    criandoCategoria: false,
    descricao: '',
    duracao: '',
    tipoPreco: 'fixo',
    preco: '',
    variacoes: [],
    profissionalIds: idLogado ? [idLogado] : [],
    ativo: true,
  }
}

function formularioDoServico(servico) {
  return {
    nome: servico.nome,
    categoria: servico.categoria,
    novaCategoria: '',
    criandoCategoria: false,
    descricao: servico.descricao || '',
    duracao: String(servico.duracao_min),
    tipoPreco: servico.tipo_preco,
    preco: textoDoPreco(servico.preco),
    variacoes: servico.variacoes.map((variacao, indice) => ({
      chave: indice + 1,
      id: variacao.id,
      nome: variacao.nome,
      preco: textoDoPreco(variacao.preco),
      duracao: String(variacao.duracao_min),
    })),
    profissionalIds: servico.profissional_ids,
    ativo: servico.ativo,
  }
}

function montarDados(formulario, id) {
  return {
    id,
    nome: formulario.nome,
    categoria: formulario.criandoCategoria ? formulario.novaCategoria : formulario.categoria,
    descricao: formulario.descricao,
    duracao_min: lerMinutos(formulario.duracao),
    tipo_preco: formulario.tipoPreco,
    preco: lerPreco(formulario.preco),
    ativo: formulario.ativo,
    variacoes: formulario.variacoes.map((variacao) => ({
      id: variacao.id,
      nome: variacao.nome,
      preco: lerPreco(variacao.preco),
      duracao_min: lerMinutos(variacao.duracao),
    })),
    profissional_ids: formulario.profissionalIds,
  }
}

function servicoDaPrevia(dados, fotoUrl) {
  const variacoes = dados.variacoes.map((variacao, indice) => ({
    id: indice + 1,
    nome: variacao.nome.trim() || 'Variação ' + (indice + 1),
    preco: variacao.preco === null ? 0 : variacao.preco,
    duracao_min: variacao.duracao_min === null ? 0 : variacao.duracao_min,
  }))
  const comVariacoes = variacoes.length > 0
  let preco = dados.preco === null ? 0 : dados.preco
  if (dados.tipo_preco === 'consulta') preco = null
  if (comVariacoes) preco = Math.min(...variacoes.map((variacao) => variacao.preco))

  return {
    id: 0,
    nome: dados.nome.trim() || 'Nome do serviço',
    categoria: dados.categoria.trim(),
    descricao: dados.descricao.trim() || null,
    foto_url: fotoUrl,
    duracao_min: comVariacoes
      ? Math.min(...variacoes.map((variacao) => variacao.duracao_min))
      : dados.duracao_min === null
        ? 0
        : dados.duracao_min,
    preco,
    tipo_preco: comVariacoes ? 'a_partir' : dados.tipo_preco,
    variacoes,
  }
}

function Secao({ id, titulo, children }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 id={id} tabIndex={-1} className="scroll-mt-24 text-2xl font-semibold">
        {titulo}
      </h2>
      {children}
    </section>
  )
}

function FormularioDeServico() {
  const navegar = useNavigate()
  const params = useParams()
  const idDaRota = params.id ? Number(params.id) : null
  const editando = params.id !== undefined
  const idLogado = profissionalLogado()

  const [base, setBase] = useState(null)
  const [formulario, setFormulario] = useState(null)
  const [inicial, setInicial] = useState('')
  const [tentouSalvar, setTentouSalvar] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroGeral, setErroGeral] = useState('')
  const [confirmarApagar, setConfirmarApagar] = useState(false)
  const [apagando, setApagando] = useState(false)
  const proximaChave = useRef(1)
  const enviando = useRef(false)
  const saindoDeProposito = useRef(false)

  useEffect(() => {
    async function carregar() {
      const [lista, profissionais, servico] = await Promise.all([
        listarServicosDoSalao(),
        listarProfissionaisAtivos(),
        editando && Number.isInteger(idDaRota) ? buscarServicoDoSalao(idDaRota) : null,
      ])
      const comeco = servico ? formularioDoServico(servico) : formularioVazio(idLogado)
      proximaChave.current = comeco.variacoes.length + 1
      setBase({ categorias: lista.categorias, profissionais, servico })
      setFormulario(comeco)
      setInicial(JSON.stringify(comeco))
    }
    carregar()
  }, [editando, idDaRota, idLogado])

  const sujo = Boolean(formulario) && JSON.stringify(formulario) !== inicial

  const bloqueio = useBlocker(
    ({ currentLocation, nextLocation }) =>
      sujo && !saindoDeProposito.current && currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (!sujo) return
    function avisarAntesDeSair(evento) {
      evento.preventDefault()
      evento.returnValue = ''
    }
    window.addEventListener('beforeunload', avisarAntesDeSair)
    return () => window.removeEventListener('beforeunload', avisarAntesDeSair)
  }, [sujo])

  if (!base) {
    return (
      <>
        <p className="sr-only" role="status">
          Carregando
        </p>
        <Esqueleto classes="h-12 w-full" />
        <Esqueleto classes="h-40 w-full" />
        <Esqueleto classes="h-40 w-full" />
      </>
    )
  }

  if (editando && !base.servico) {
    return (
      <Card>
        <p className="font-semibold">Serviço não encontrado.</p>
        <p className="text-texto-suave">Ele pode ter sido apagado.</p>
        <Botao para="/salao/servicos" variante="secundario">
          Ver serviços
        </Botao>
      </Card>
    )
  }

  function mudar(campo, valor) {
    setFormulario((atual) => ({ ...atual, [campo]: valor }))
  }

  function mudarVariacao(chave, campo, valor) {
    setFormulario((atual) => ({
      ...atual,
      variacoes: atual.variacoes.map((variacao) => (variacao.chave === chave ? { ...variacao, [campo]: valor } : variacao)),
    }))
  }

  function focarDepois(id) {
    requestAnimationFrame(() => {
      const elemento = document.getElementById(id)
      if (elemento) elemento.focus()
    })
  }

  function adicionarVariacoes(nomes) {
    const espaco = limiteDeVariacoes - formulario.variacoes.length
    const novas = nomes.slice(0, espaco).map((nome) => ({
      chave: proximaChave.current++,
      id: null,
      nome,
      preco: '',
      duracao: lerMinutos(formulario.duracao) === null ? '' : formulario.duracao,
    }))
    if (novas.length === 0) return
    mudar('variacoes', [...formulario.variacoes, ...novas])
    focarDepois('variacao-' + novas[0].chave + (novas[0].nome ? '-preco' : '-nome'))
  }

  function removerVariacao(chave) {
    mudar(
      'variacoes',
      formulario.variacoes.filter((variacao) => variacao.chave !== chave),
    )
    focarDepois('botao-adicionar-variacao')
  }

  function alternarProfissional(id) {
    const marcado = formulario.profissionalIds.includes(id)
    mudar(
      'profissionalIds',
      marcado ? formulario.profissionalIds.filter((item) => item !== id) : [...formulario.profissionalIds, id],
    )
  }

  const dados = montarDados(formulario, editando ? idDaRota : null)
  const erros = errosDoServico(dados)
  const mostrar = (chave) => (tentouSalvar && erros[chave] ? erros[chave] : '')
  const erroDaVariacao = (indice, campo) =>
    tentouSalvar && erros.variacoes && erros.variacoes[indice] ? erros.variacoes[indice][campo] || '' : ''
  const comVariacoes = formulario.variacoes.length > 0
  const nomesDasVariacoes = formulario.variacoes.map((variacao) => variacao.nome.trim().toLowerCase())
  const tamanhosQueFaltam = tamanhosPadrao.filter((nome) => !nomesDasVariacoes.includes(nome.toLowerCase()))
  const variacoesValidas = dados.variacoes.filter((variacao) => variacao.preco > 0 && variacao.duracao_min > 0)
  const duracaoLida = lerMinutos(formulario.duracao)

  function primeiroCampoComErro() {
    if (erros.nome) return 'campo-nome'
    if (erros.categoria) return formulario.criandoCategoria ? 'campo-nova-categoria' : 'titulo-categoria'
    if (erros.descricao) return 'campo-descricao'
    if (erros.duracao) return 'campo-duracao'
    if (erros.preco) return 'campo-preco'
    if (erros.quantidadeDeVariacoes) return 'titulo-variacoes'
    if (erros.variacoes) {
      const indice = erros.variacoes.findIndex((erro) => Object.keys(erro).length > 0)
      const campo = Object.keys(erros.variacoes[indice])[0]
      return 'variacao-' + formulario.variacoes[indice].chave + '-' + campo
    }
    if (erros.profissionais) return 'titulo-profissionais'
    return null
  }

  async function salvar() {
    if (enviando.current) return
    setTentouSalvar(true)
    setErroGeral('')
    const campo = primeiroCampoComErro()
    if (campo) {
      const elemento = document.getElementById(campo)
      elemento.scrollIntoView({ block: 'center' })
      elemento.focus({ preventScroll: true })
      return
    }

    enviando.current = true
    setSalvando(true)
    const resultado = await salvarServico(dados)
    if (resultado.erro) {
      setErroGeral(
        resultado.erro === 'nao_encontrado'
          ? 'Este serviço não existe mais.'
          : resultado.erro === 'invalido'
            ? 'Confira os campos marcados.'
            : 'Não conseguimos salvar. Tente de novo.',
      )
      setSalvando(false)
      enviando.current = false
      return
    }

    saindoDeProposito.current = true
    navegar('/salao/servicos', { replace: true, state: { aviso: 'Serviço salvo: ' + resultado.servico.nome + '.' } })
  }

  async function apagar() {
    setApagando(true)
    const resultado = await apagarServico(idDaRota)
    if (resultado.erro) {
      setApagando(false)
      setConfirmarApagar(false)
      setErroGeral(
        resultado.erro === 'usado'
          ? 'Este serviço já foi usado em agendamentos e não pode ser apagado. Deixe inativo.'
          : 'Não conseguimos apagar. Tente de novo.',
      )
      return
    }
    saindoDeProposito.current = true
    navegar('/salao/servicos', { replace: true, state: { aviso: 'Serviço apagado: ' + resultado.apagado.nome + '.' } })
  }

  return (
    <>
      <Secao id="titulo-dados" titulo="Dados do serviço">
        <CampoTexto
          id="campo-nome"
          rotulo="Nome"
          valor={formulario.nome}
          aoMudar={(valor) => mudar('nome', valor)}
          erro={mostrar('nome')}
          autoCompletar="off"
          limite={60}
          obrigatorio
        />

        <fieldset className="flex flex-col gap-2">
          <legend id="titulo-categoria" tabIndex={-1} className="mb-2 font-medium">
            Categoria
          </legend>
          <div className="flex flex-wrap gap-2">
            {base.categorias.map((categoria) => (
              <Chip
                key={categoria}
                selecionado={!formulario.criandoCategoria && formulario.categoria === categoria}
                aoClicar={() => setFormulario((atual) => ({ ...atual, categoria, criandoCategoria: false }))}
              >
                {categoria}
              </Chip>
            ))}
            <Chip
              selecionado={formulario.criandoCategoria}
              aoClicar={() => {
                setFormulario((atual) => ({ ...atual, criandoCategoria: true }))
                focarDepois('campo-nova-categoria')
              }}
            >
              <Plus className="size-5" aria-hidden="true" />
              Nova categoria
            </Chip>
          </div>
          {formulario.criandoCategoria && (
            <CampoTexto
              id="campo-nova-categoria"
              rotulo="Nome da nova categoria"
              valor={formulario.novaCategoria}
              aoMudar={(valor) => mudar('novaCategoria', valor)}
              erro={mostrar('categoria')}
              autoCompletar="off"
              limite={30}
            />
          )}
          {!formulario.criandoCategoria && mostrar('categoria') && <MensagemErro texto={mostrar('categoria')} />}
        </fieldset>

        <CampoTexto
          id="campo-descricao"
          rotulo="Descrição curta"
          valor={formulario.descricao}
          aoMudar={(valor) => mudar('descricao', valor)}
          erro={mostrar('descricao')}
          ajuda={formulario.descricao.length + ' de 160 caracteres'}
          opcional
          multilinha
          limite={160}
        />
      </Secao>

      <Secao id="titulo-preco" titulo="Duração e preço">
        {comVariacoes ? (
          <Card>
            <p>
              Com variações, o cardápio mostra <strong>a partir de</strong> com o menor valor
              {variacoesValidas.length === formulario.variacoes.length
                ? ': ' +
                  formatarPreco(Math.min(...variacoesValidas.map((variacao) => variacao.preco))) +
                  ' e ' +
                  formatarDuracao(Math.min(...variacoesValidas.map((variacao) => variacao.duracao_min))) +
                  '.'
                : ' das variações.'}
            </p>
          </Card>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <p className="font-medium" id="rotulo-atalhos-duracao">
                Duração
              </p>
              <div className="flex flex-wrap gap-2" role="group" aria-labelledby="rotulo-atalhos-duracao">
                {duracoesRapidas.map((minutos) => (
                  <Chip
                    key={minutos}
                    selecionado={duracaoLida === minutos}
                    aoClicar={() => mudar('duracao', String(minutos))}
                  >
                    {formatarDuracao(minutos)}
                  </Chip>
                ))}
              </div>
            </div>
            <CampoTexto
              id="campo-duracao"
              rotulo="Duração em minutos"
              valor={formulario.duracao}
              aoMudar={(valor) => mudar('duracao', valor.replace(/\D/g, ''))}
              erro={mostrar('duracao')}
              ajuda={duracaoLida ? 'Fica ' + formatarDuracao(duracaoLida) + ' na agenda.' : 'Toque num atalho ou digite.'}
              modoDeEntrada="numeric"
              autoCompletar="off"
              limite={4}
            />

            <fieldset className="flex flex-col">
              <legend className="mb-1 font-medium">Tipo de preço</legend>
              {tiposDePreco.map((tipo) => (
                <OpcaoDeEscolha
                  key={tipo.valor}
                  nome="tipo-de-preco"
                  valor={tipo.valor}
                  marcado={formulario.tipoPreco === tipo.valor}
                  aoMarcar={() => mudar('tipoPreco', tipo.valor)}
                  titulo={tipo.titulo}
                  explicacao={tipo.explicacao}
                />
              ))}
            </fieldset>

            {formulario.tipoPreco !== 'consulta' && (
              <CampoTexto
                id="campo-preco"
                rotulo={formulario.tipoPreco === 'a_partir' ? 'Preço mínimo (R$)' : 'Preço (R$)'}
                valor={formulario.preco}
                aoMudar={(valor) => mudar('preco', valor)}
                erro={mostrar('preco')}
                placeholder="Ex.: 45,00"
                modoDeEntrada="decimal"
                autoCompletar="off"
                limite={12}
              />
            )}
          </>
        )}
      </Secao>

      <Secao id="titulo-variacoes" titulo="Tamanhos e variações">
        <p className="text-texto-suave">
          Opcional. Use quando o preço ou o tempo mudam com o tamanho do cabelo. O cliente escolhe a variação ao
          agendar.
        </p>
        {mostrar('quantidadeDeVariacoes') && <MensagemErro texto={mostrar('quantidadeDeVariacoes')} />}

        {formulario.variacoes.length > 0 && (
          <ul className="flex flex-col gap-3">
            {formulario.variacoes.map((variacao, indice) => (
              <li key={variacao.chave} className="flex flex-col gap-3 rounded-2xl border-2 border-borda bg-superficie p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">Variação {indice + 1}</p>
                  <button
                    type="button"
                    onClick={() => removerVariacao(variacao.chave)}
                    aria-label={'Remover variação ' + (variacao.nome.trim() || indice + 1)}
                    className="flex size-12 items-center justify-center rounded-xl border-2 border-perigo text-perigo"
                  >
                    <Trash2 className="size-5" aria-hidden="true" />
                  </button>
                </div>
                <CampoTexto
                  id={'variacao-' + variacao.chave + '-nome'}
                  rotulo="Nome"
                  valor={variacao.nome}
                  aoMudar={(valor) => mudarVariacao(variacao.chave, 'nome', valor)}
                  erro={erroDaVariacao(indice, 'nome')}
                  autoCompletar="off"
                  limite={30}
                />
                <div className="grid grid-cols-2 gap-3">
                  <CampoTexto
                    id={'variacao-' + variacao.chave + '-preco'}
                    rotulo="Preço (R$)"
                    valor={variacao.preco}
                    aoMudar={(valor) => mudarVariacao(variacao.chave, 'preco', valor)}
                    erro={erroDaVariacao(indice, 'preco')}
                    modoDeEntrada="decimal"
                    autoCompletar="off"
                    limite={12}
                  />
                  <CampoTexto
                    id={'variacao-' + variacao.chave + '-duracao'}
                    rotulo="Duração (min)"
                    valor={variacao.duracao}
                    aoMudar={(valor) => mudarVariacao(variacao.chave, 'duracao', valor.replace(/\D/g, ''))}
                    erro={erroDaVariacao(indice, 'duracao')}
                    modoDeEntrada="numeric"
                    autoCompletar="off"
                    limite={4}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        {tamanhosQueFaltam.length === tamanhosPadrao.length && formulario.variacoes.length <= limiteDeVariacoes - 3 && (
          <Botao variante="secundario" larguraTotal aoClicar={() => adicionarVariacoes(tamanhosPadrao)}>
            <Ruler className="size-5" aria-hidden="true" />
            Adicionar tamanhos Curto, Médio e Longo
          </Botao>
        )}
        {formulario.variacoes.length < limiteDeVariacoes ? (
          <button
            type="button"
            id="botao-adicionar-variacao"
            onClick={() => adicionarVariacoes([''])}
            className="flex min-h-12 items-center gap-2 font-semibold text-principal underline underline-offset-4"
          >
            <Plus className="size-5" aria-hidden="true" />
            Adicionar variação
          </button>
        ) : (
          <p id="botao-adicionar-variacao" tabIndex={-1} className="text-texto-suave">
            Limite de {limiteDeVariacoes} variações.
          </p>
        )}
      </Secao>

      <Secao id="titulo-profissionais" titulo="Quem faz este serviço">
        {mostrar('profissionais') && <MensagemErro texto={mostrar('profissionais')} />}
        <fieldset className="flex flex-col">
          <legend className="sr-only">Profissionais que fazem o serviço</legend>
          {base.profissionais.map((profissional) => (
            <OpcaoDeEscolha
              key={profissional.id}
              tipo="checkbox"
              nome="profissionais"
              valor={profissional.id}
              marcado={formulario.profissionalIds.includes(profissional.id)}
              aoMarcar={() => alternarProfissional(profissional.id)}
              titulo={profissional.nome + (profissional.id === idLogado ? ' (você)' : '')}
            />
          ))}
        </fieldset>
      </Secao>

      <Secao id="titulo-situacao" titulo="Situação">
        <fieldset className="flex flex-col">
          <legend className="sr-only">Situação do serviço</legend>
          <OpcaoDeEscolha
            nome="situacao"
            valor="ativo"
            marcado={formulario.ativo}
            aoMarcar={() => mudar('ativo', true)}
            titulo="Ativo"
            explicacao="Aparece no cardápio e no novo agendamento."
          />
          <OpcaoDeEscolha
            nome="situacao"
            valor="inativo"
            marcado={!formulario.ativo}
            aoMarcar={() => mudar('ativo', false)}
            titulo="Inativo"
            explicacao="Some do cardápio e do novo agendamento. Agendamentos já feitos continuam iguais."
          />
        </fieldset>
      </Secao>

      <Secao id="titulo-previa" titulo="Como o cliente vê">
        {!formulario.ativo && (
          <p className="font-semibold">Inativo: hoje o cliente não vê este serviço.</p>
        )}
        <div inert className={formulario.ativo ? '' : 'opacity-60'}>
          <CardServico
            servico={servicoDaPrevia(dados, base.servico ? base.servico.foto_url : null)}
            itemEscolhido={null}
            aoTocar={() => {}}
          />
        </div>
      </Secao>

      {editando && (
        <Secao id="titulo-apagar" titulo="Apagar">
          {base.servico.usado ? (
            <p className="text-texto-suave">
              Este serviço já foi usado em agendamentos, por isso não pode ser apagado. Para tirar do cardápio, marque
              Inativo.
            </p>
          ) : (
            <>
              <p className="text-texto-suave">Este serviço nunca foi usado em agendamentos, então pode ser apagado.</p>
              <Botao variante="secundario" larguraTotal aoClicar={() => setConfirmarApagar(true)}>
                <Trash2 className="size-5" aria-hidden="true" />
                Apagar serviço
              </Botao>
            </>
          )}
        </Secao>
      )}

      <RodapeFixo>
        {tentouSalvar && temErros(erros) && <MensagemErro texto="Confira os campos marcados." />}
        {erroGeral && <MensagemErro texto={erroGeral} />}
        <Botao larguraTotal grande carregando={salvando} aoClicar={salvar}>
          {salvando ? 'Salvando...' : 'Salvar serviço'}
        </Botao>
      </RodapeFixo>

      <Dialogo
        aberto={confirmarApagar}
        titulo={base.servico ? 'Apagar ' + base.servico.nome + '?' : ''}
        aoFechar={() => setConfirmarApagar(false)}
      >
        <p className="text-texto-suave">Ele sai do cardápio e não dá para desfazer. Para só esconder, use Inativo.</p>
        <div className="flex flex-col gap-2">
          <Botao variante="secundario" larguraTotal aoClicar={() => setConfirmarApagar(false)}>
            Manter serviço
          </Botao>
          <Botao variante="perigo" larguraTotal carregando={apagando} aoClicar={apagar}>
            Apagar
          </Botao>
        </div>
      </Dialogo>

      <Dialogo
        aberto={bloqueio.state === 'blocked'}
        titulo="Sair sem salvar?"
        aoFechar={() => {
          if (bloqueio.state === 'blocked') bloqueio.reset()
        }}
      >
        <p className="text-texto-suave">As alterações deste serviço vão ser perdidas.</p>
        <div className="flex flex-col gap-2">
          <Botao variante="secundario" larguraTotal aoClicar={() => bloqueio.reset()}>
            Continuar editando
          </Botao>
          <Botao variante="perigo" larguraTotal aoClicar={() => bloqueio.proceed()}>
            Sair sem salvar
          </Botao>
        </div>
      </Dialogo>
    </>
  )
}

export default FormularioDeServico
