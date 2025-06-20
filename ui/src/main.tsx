import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { IntuProvider } from "@intuweb3/web-kit";

const intuConfig = {
  authProviders: ["google", "twitter", "apple"],
  isCustomAuth: false,
  styles: {
    applicationName: "Hi",
    applicationLogo:
      "https://docs.intu.xyz/assets/images/Door_INTU_Grad_trans-65422226baa0bd52d9e7e2ce54c41ba2.png",
    applicationDescription: "No wallet needed!",
    theme: "dark",
    customCSS: `
      * { scrollbar-width: none !important; -ms-overflow-style: none !important; }
      *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
    `
  },
  claimUrl: "https://intudrip.xyz/faucet/claimarbitrumsepolia",
  appId: "1:499664624959:web:bf72f54040d3a9c955878a",
  nodeSigner1: "0x7d8a43adf7293cfe98cf3680adec6e2bf0351587",
  nodeSigner2: "0xc29cd9ff0460b9c9bbc4b410eb175512431bb5b7",
  network: "arbitrum-sepolia",
  enableVaultManagement: true,
};

createRoot(document.getElementById("root")!).render(
  <IntuProvider initialConfig={intuConfig}>
    <App />
  </IntuProvider>
);
