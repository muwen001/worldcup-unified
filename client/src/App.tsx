import React, { useState } from 'react';
import { AppProvider } from './context/AppContext';
import { Header } from './components/layout/Header';
import { MatchesPage } from './pages/Matches/MatchesPage';
import { TeamsPage } from './pages/Teams/TeamsPage';
import { HistoryPage } from './pages/History/HistoryPage';

const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('matches');

  const renderPage = () => {
    switch (currentPage) {
      case 'matches':
        return <MatchesPage />;
      case 'teams':
        return <TeamsPage />;
      case 'history':
        return <HistoryPage />;
      default:
        return <MatchesPage />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header currentPage={currentPage} onPageChange={setCurrentPage} />
      <main className="max-w-7xl mx-auto px-4 py-6">
        {renderPage()}
      </main>
    </div>
  );
};

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
