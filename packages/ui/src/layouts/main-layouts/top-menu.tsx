import { useEffect, type ReactEventHandler, type ReactNode } from "react";
import { CommandIcon, MenuIcon, SearchIcon } from "lucide-react";
import { Button } from "../../components/button";
import { TopMenuAppLauncher } from "./top-menu-app-launcher";
import { TopMenuNotifications, type TopMenuNotification } from "./top-menu-notifications";
import { TopMenuSearch, type TopMenuSearchItem } from "./top-menu-search";
import type { TopMenuAppItem, TopMenuUser } from "./top-menu-types";
import { TopMenuUserMenu } from "./top-menu-user";

export type TopMenuProps = {
  addonItems?: TopMenuAppItem[];
  appItems: TopMenuAppItem[];
  applicationName: string;
  companyBrand?: {
    name: string;
    logoSrc?: string;
    logoDarkSrc?: string;
  };
  logoutHref?: string;
  notifications: TopMenuNotification[];
  onCloseSearch: () => void;
  onLogout?: () => void | Promise<void>;
  onNotificationDismiss?: (id: string) => void;
  onOpenSearch: () => void;
  onProfile?: () => void;
  onSearchChange: (value: string) => void;
  onToggleSidebar: () => void;
  profileHref?: string;
  search: string;
  searchDialogClassName?: string;
  searchItems: TopMenuSearchItem[];
  searchOpen: boolean;
  searchPlaceholder: string;
  searchLeadingAction?: ReactNode;
  user: TopMenuUser;
};

export function TopMenu({
  addonItems = [],
  appItems,
  applicationName,
  companyBrand,
  logoutHref,
  notifications,
  onCloseSearch,
  onLogout,
  onNotificationDismiss,
  onOpenSearch,
  onProfile,
  onSearchChange,
  onToggleSidebar,
  profileHref,
  search,
  searchDialogClassName,
  searchItems,
  searchOpen,
  searchPlaceholder,
  searchLeadingAction,
  user
}: TopMenuProps) {
  useEffect(() => {
    function openSearch(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenSearch();
      }
    }
    window.addEventListener("keydown", openSearch);
    return () => window.removeEventListener("keydown", openSearch);
  }, [onOpenSearch]);

  return (
    <>
      <header className="flex h-12 shrink-0 items-center justify-between border-b">
        <div className="flex h-full min-w-0 items-center">
          <Button
            aria-label="Toggle application navigation"
            className="h-full w-12 rounded-none border-r"
            onClick={onToggleSidebar}
            size="icon"
            type="button"
            variant="ghost"
          >
            <MenuIcon className="size-4" />
          </Button>
          <div className="flex min-w-0 items-center gap-3 px-5 text-sm font-semibold">
            {companyBrand ? (
              <>
                <img
                  alt={`${companyBrand.name} logo`}
                  className="size-6 shrink-0 object-contain dark:hidden"
                  src={companyBrand.logoSrc ?? "/logo/logo.svg"}
                  onError={fallbackLogo("/logo/logo.svg")}
                />
                <img
                  alt={`${companyBrand.name} logo`}
                  className="hidden size-6 shrink-0 object-contain dark:block"
                  src={companyBrand.logoDarkSrc ?? companyBrand.logoSrc ?? "/logo/logo-dark.svg"}
                  onError={fallbackLogo("/logo/logo-dark.svg")}
                />
                <span className="truncate" title={companyBrand.name}>
                  {companyBrand.name}
                </span>
                <span aria-hidden="true" className="shrink-0 text-muted-foreground">
                  |
                </span>
              </>
            ) : (
              <CommandIcon className="size-4 shrink-0" />
            )}
            <span className="shrink-0">{applicationName}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4">
          {searchLeadingAction}
          <Button
            className="h-8 gap-2 rounded-full shadow-sm"
            onClick={onOpenSearch}
            size="sm"
            type="button"
            variant="outline"
          >
            <SearchIcon className="size-4" /> <span className="hidden sm:inline">Search</span>
            <kbd className="hidden rounded bg-muted px-1 text-[10px] text-muted-foreground sm:inline">
              Ctrl K
            </kbd>
          </Button>
          <TopMenuNotifications
            notifications={notifications}
            {...(onNotificationDismiss ? { onDismiss: onNotificationDismiss } : {})}
          />
          <TopMenuAppLauncher addonItems={addonItems} items={appItems} />
          <TopMenuUserMenu
            {...(logoutHref ? { logoutHref } : {})}
            {...(onLogout ? { onLogout } : {})}
            {...(onProfile ? { onProfile } : {})}
            {...(profileHref ? { profileHref } : {})}
            user={user}
          />
        </div>
      </header>
      <TopMenuSearch
        {...(searchDialogClassName ? { contentClassName: searchDialogClassName } : {})}
        items={searchItems}
        onClose={onCloseSearch}
        onSearchChange={onSearchChange}
        open={searchOpen}
        placeholder={searchPlaceholder}
        search={search}
      />
    </>
  );
}

function fallbackLogo(path: string): ReactEventHandler<HTMLImageElement> {
  return (event) => {
    const image = event.currentTarget;
    if (image.src !== new URL(path, window.location.origin).href) image.src = path;
  };
}
