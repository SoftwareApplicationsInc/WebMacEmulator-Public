import {createRoot} from "react-dom/client";
import "./index.css";
import App from "./App";
import {canSaveDisks} from "./canSaveDisks";
import mixpanel from 'mixpanel-browser';

const productionProjectToken = 'f2141b89bfd5b2191ddb50c92057b223';
const developmentProjectToken = '959441d79155e201763876370bf8b087';
// Assume we're in production unless we're on localhost
const projectToken = window.location.hostname === 'localhost' ? developmentProjectToken : productionProjectToken;
mixpanel.init(projectToken, { track_pageview: true, persistence: 'localStorage', api_host: "https://sai-mixpanel-proxy-4fbaadb6cfb5.herokuapp.com" });

// Determining if we can save data is an async operation, kick off the request
// now so that we're more likely to have the answer by the time the we actually
// need to decide if we can mount the saved disk.
try {
    canSaveDisks();
} catch (e) {
    // Ignore.
}

const root = createRoot(document.getElementById("root")!);

root.render(<App />);
