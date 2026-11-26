import { Route, Routes } from 'react-router-dom'
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
import Configuracoes from './pages/salao/Configuracoes.jsx'
import Entrar from './pages/salao/Entrar.jsx'
import ServicosDoSalao from './pages/salao/Servicos.jsx'

function App() {
  return (
    <Routes>
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
      <Route path="/salao" element={<LayoutSalao />}>
        <Route index element={<Agenda />} />
        <Route path="servicos" element={<ServicosDoSalao />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="configuracoes" element={<Configuracoes />} />
      </Route>

      <Route path="/componentes" element={<Componentes />} />
      <Route path="*" element={<NaoEncontrada />} />
    </Routes>
  )
}

export default App
