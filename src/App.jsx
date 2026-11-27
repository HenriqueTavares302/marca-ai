import { Route, RouterProvider, createBrowserRouter, createRoutesFromElements } from 'react-router-dom'
import LayoutCliente from './layouts/LayoutCliente.jsx'
import LayoutSalao from './layouts/LayoutSalao.jsx'
import Componentes from './pages/Componentes.jsx'
import NaoEncontrada from './pages/NaoEncontrada.jsx'
import Agendar from './pages/cliente/Agendar.jsx'
import AgendarConfirmacao from './pages/cliente/AgendarConfirmacao.jsx'
import AgendarDados from './pages/cliente/AgendarDados.jsx'
import AgendarHorario from './pages/cliente/AgendarHorario.jsx'
import AgendarSucesso from './pages/cliente/AgendarSucesso.jsx'
import Inicio from './pages/cliente/Inicio.jsx'
import MeusAgendamentos from './pages/cliente/MeusAgendamentos.jsx'
import ServicosDoCliente from './pages/cliente/Servicos.jsx'
import Agenda from './pages/salao/Agenda.jsx'
import Clientes from './pages/salao/Clientes.jsx'
import Bloqueios from './pages/salao/Bloqueios.jsx'
import Configuracoes from './pages/salao/Configuracoes.jsx'
import Entrar from './pages/salao/Entrar.jsx'
import EsqueciSenha from './pages/salao/EsqueciSenha.jsx'
import NovaSenha from './pages/salao/NovaSenha.jsx'
import FichaDoCliente from './pages/salao/FichaDoCliente.jsx'
import FormularioDeCliente from './pages/salao/FormularioDeCliente.jsx'
import NovoAgendamento from './pages/salao/NovoAgendamento.jsx'
import NovoBloqueio from './pages/salao/NovoBloqueio.jsx'
import Resumo from './pages/salao/Resumo.jsx'
import FormularioDeServico from './pages/salao/FormularioDeServico.jsx'
import HorariosDeTrabalho from './pages/salao/HorariosDeTrabalho.jsx'
import ServicosDoSalao from './pages/salao/Servicos.jsx'

const rotas = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route element={<LayoutCliente />}>
        <Route path="/" element={<Inicio />} />
        <Route path="/servicos" element={<ServicosDoCliente />} />
        <Route path="/agendar" element={<Agendar />} />
        <Route path="/agendar/horario" element={<AgendarHorario />} />
        <Route path="/agendar/dados" element={<AgendarDados />} />
        <Route path="/agendar/confirmacao" element={<AgendarConfirmacao />} />
        <Route path="/agendar/sucesso" element={<AgendarSucesso />} />
        <Route path="/meus-agendamentos" element={<MeusAgendamentos />} />
      </Route>

      <Route path="/salao/entrar" element={<Entrar />} />
      <Route path="/salao/esqueci-senha" element={<EsqueciSenha />} />
      <Route path="/salao/nova-senha" element={<NovaSenha />} />
      <Route path="/salao" element={<LayoutSalao />}>
        <Route index element={<Agenda />} />
        <Route path="servicos" element={<ServicosDoSalao />} />
        <Route path="servicos/novo" element={<FormularioDeServico />} />
        <Route path="servicos/:id" element={<FormularioDeServico />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="clientes/novo" element={<FormularioDeCliente />} />
        <Route path="clientes/:id" element={<FichaDoCliente />} />
        <Route path="clientes/:id/editar" element={<FormularioDeCliente />} />
        <Route path="configuracoes" element={<Configuracoes />} />
        <Route path="configuracoes/horarios" element={<HorariosDeTrabalho />} />
        <Route path="configuracoes/bloqueios" element={<Bloqueios />} />
        <Route path="configuracoes/bloqueios/novo" element={<NovoBloqueio />} />
        <Route path="novo" element={<NovoAgendamento />} />
        <Route path="resumo" element={<Resumo />} />
      </Route>

      <Route path="/componentes" element={<Componentes />} />
      <Route path="*" element={<NaoEncontrada />} />
    </>,
  ),
)

function App() {
  return <RouterProvider router={rotas} />
}

export default App
