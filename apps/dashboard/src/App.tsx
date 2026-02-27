import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import Home from './pages/Dashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/home-landing" element={<HomePage />} />
        <Route path="/home" element={<Home />} />
        <Route path="/dashboard" element={<Navigate to="/home" replace />} />
      </Routes>
    </Router>
  );
}

export default App;