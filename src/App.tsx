import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import MaterialUploadHub from './pages/MaterialUploadHub';
import GapChallenge from './pages/GapChallenge';
import Dashboard from './pages/Dashboard';
import MaterialQuiz from './pages/MaterialQuiz';
import Review from './pages/Review';
import Settings from './pages/Settings';
import EditMaterial from './pages/EditMaterial';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<MaterialUploadHub />} />
        <Route path="/quiz/:materialId" element={<MaterialQuiz />} />
        <Route path="/edit-material/:materialId" element={<EditMaterial />} />
        <Route path="/review" element={<Review />} />
        <Route path="/challenge" element={<GapChallenge />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
}

export default App;
