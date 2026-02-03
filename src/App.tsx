import NotificationListener from './components/NotificationListener';
import Toast, { useToast } from './components/Toast';
import Routes from './router'; // Este componente usa react-router-dom internamente

function App() {
  const { toast, showToast, hideToast } = useToast();

  return (
    <div className="app-container h-screen w-full">
      <NotificationListener showToast={showToast} />
      
      {/* Agora o Routes terá o contexto do Router definido no index.tsx */}
      <Routes showToast={showToast} />
    
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={hideToast} 
        />
      )}
    </div>
  );
}

export default App;