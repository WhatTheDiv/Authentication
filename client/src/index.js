import React from 'react';
import ReactDOM from 'react-dom/client';
import './Components/Styles/index.css';
import App from './Components/Component/App';
import ErrorBoundary from './Components/Component/ErrorBoundary';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render( 
<ErrorBoundary fallback='Therre was an error'>
  <React.StrictMode>
    <App />
  </React.StrictMode>   
</ErrorBoundary>
);

