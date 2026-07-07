import { Header } from '../../components';
import { HomeSection } from '../../sections';

export const HomePage = () => (
  <div className="h-screen overflow-hidden">
    <Header />
    <main className="mt-16 h-[calc(100vh-4rem)] overflow-y-auto overflow-x-hidden">
      <HomeSection />
    </main>
  </div>
);
