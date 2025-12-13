import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// We don't need to wait for gameEngine.initialize() in v7 as it's synchronous/lazy

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
