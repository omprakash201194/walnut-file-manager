import { HashRouter, Routes, Route } from 'react-router'
import Layout from './components/Layout'
import DuplicatesPage from './pages/DuplicatesPage'
import OrganizerPage from './pages/OrganizerPage'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DuplicatesPage />} />
          <Route path="/organizer" element={<OrganizerPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
