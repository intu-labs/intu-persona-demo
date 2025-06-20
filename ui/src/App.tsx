import { useState, useEffect } from "react";
import { ThemeProvider } from "./components/theme-provider";
import { MainLayout } from "./components/layouts/main-layout";
import { ChatInterface } from "./components/chat/chat-interface";

function App() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return (
    <ThemeProvider defaultTheme="dark">
      <MainLayout>
        <ChatInterface />
      </MainLayout>
    </ThemeProvider>
  );
}

export default App;
