import { createRoot } from 'react-dom/client';
import App from './app/App.tsx';
import './styles/index.css';
import { captureHubCountry } from './app/utils/hubCountry';
import { CountryPicker } from './app/components/CountryPicker';

// Builder Hub 에서 넘어온 국가(?hub_country=)를 저장하고 주소에서 지운다.
// 허브를 거치지 않고 바로 들어왔으면 첫 화면에서 CountryPicker 가 묻는다
captureHubCountry();

createRoot(document.getElementById('root')!).render(<><App /><CountryPicker /></>);
