import { KoblyStoreProvider } from '@/store/store.jsx';
import { Shell } from '@/shell/AppShell.jsx';

export default function App() {
  return (
    <KoblyStoreProvider>
      <Shell />
    </KoblyStoreProvider>
  );
}
