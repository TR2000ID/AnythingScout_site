// The frame around every page: the sidebar on the left (search + choices + pages), the current page on the right.
// Phones: a top bar with ☰ and the search box; ☰ slides the sidebar in from the left.
import * as Dialog from "@radix-ui/react-dialog";
import { Menu } from "lucide-react";
import { useEffect } from "react";
import { ShowDialog } from "./components/ShowDialog";
import { SearchBar } from "./components/SearchBar";
import { Sidebar } from "./components/Sidebar";
import { Toasts } from "./components/Toasts";
import { About } from "./pages/About";
import { ForYou } from "./pages/ForYou";
import { MyList } from "./pages/MyList";

import { Settings } from "./pages/Settings";
import { Together } from "./pages/Together";
import { useStore } from "./state/createStore";
import { useTexts } from "./state/settings";
import { menuStore, MY_LIST, useIsNarrow, usePage, type MyListName } from "./state/ui";

export function App() {
  const t = useTexts();
  const page = usePage();
  const narrow = useIsNarrow();
  const menuOpen = useStore(menuStore);
  useEffect(() => menuStore.set(false), [page]); // going to another page closes the phone menu

  return (
    <div className="app">
      {!narrow && (
        <aside className="sidebar">
          <Sidebar />
        </aside>
      )}

      {narrow && (
        <Dialog.Root open={menuOpen} onOpenChange={menuStore.set}>
          <Dialog.Portal>
            <Dialog.Overlay className="drawer-overlay" />
            <Dialog.Content className="drawer" aria-describedby={undefined}>
              <Dialog.Title className="visually-hidden">{t.nav.openMenu}</Dialog.Title>
              <Sidebar search={false} />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      <div className="main">
        {narrow && (
          <header className="topbar">
            <button className="icon-button menu-button" aria-label={t.nav.openMenu} onClick={() => menuStore.set(true)}>
              <Menu size={20} />
            </button>
            <SearchBar />
          </header>
        )}
        <main className="page">
          {page === "for-you" && <ForYou />}
          {page === "together" && <Together />}
          {(MY_LIST as readonly string[]).includes(page) && <MyList which={page as MyListName} />}
          {page === "settings" && <Settings />}
          {page === "about" && <About />}
        </main>
      </div>

      <ShowDialog />
      <Toasts />
    </div>
  );
}
