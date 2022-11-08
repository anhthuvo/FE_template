import React from 'react';
import './App.css';
import AuthStore from './store/auth'
import TrackingStore from './store/auth'

function App() {
  return (
    <AuthStore>
      <TrackingStore>
      <div className="App">
            <header className="App-header">
              <p>
                Edit <code>src/App.tsx</code> and save to reload.
              </p>
              <a
                className="App-link"
                href="https://reactjs.org"
                target="_blank"
                rel="noopener noreferrer"
              >
                Learn React
              </a>
            </header>
          </div>
        </TrackingStore>
    </AuthStore>
  );
}

export default App;
