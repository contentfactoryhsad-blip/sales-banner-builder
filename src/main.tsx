import { createRoot } from 'react-dom/client';
import App from './app/App.tsx';
import './styles/index.css';
import { captureHubCountry } from './app/utils/hubCountry';

// Builder Hub 에서 넘어온 국가(?hub_country=)를 저장하고 주소에서 지운다
captureHubCountry();

createRoot(document.getElementById('root')!).render(<App />);
