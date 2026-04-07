import 'primereact/resources/themes/lara-light-blue/theme.css'; // or any other PrimeReact theme you like
import 'primereact/resources/primereact.min.css'; 
import 'primeicons/primeicons.css'; 

import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById("root")!).render(<App />);
