import { SidebarLeft, TriangleRightMini, XMark } from "@medusajs/icons";
import { IconButton, clx } from "@medusajs/ui";
import { AnimatePresence } from "motion/react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { PropsWithChildren, ReactNode, useEffect, useState } from "react";
import { Link, Outlet, useMatches, useNavigation } from "react-router-dom";
import type { UIMatch } from "react-router-dom";
import { useSidebar } from "../../providers/sidebar-provider/sidebar-provider";
import { ProgressBar } from "../common/progress-bar";
import { MainSidebar } from "./main-sidebar";

export const Shell = ({ children }: PropsWithChildren) => {
  const navigation = useNavigation();
  const loading = navigation.state === "loading";

  return (
    <div className="relative flex h-screen flex-col items-start overflow-hidden lg:flex-row">
      <NavigationBar loading={loading} />
      <div>
        <MobileSidebarContainer>
          <MainSidebar />
        </MobileSidebarContainer>
        <DesktopSidebarContainer>
          <MainSidebar />
        </DesktopSidebarContainer>
      </div>
      <div className="flex h-screen w-full flex-col overflow-auto">
        <Topbar />
        <main
          className={clx(
            "flex h-full w-full flex-col items-center overflow-y-auto transition-opacity delay-200 duration-200",
            {
              "opacity-25": loading,
            }
          )}
        >
          <Gutter>
            <Outlet />
          </Gutter>
        </main>
      </div>
    </div>
  );
};

const NavigationBar = ({ loading }: { loading: boolean }) => {
  const [showBar, setShowBar] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (loading) {
      timeout = setTimeout(() => {
        setShowBar(true);
      }, 200);
    } else {
      setShowBar(false);
    }
    return () => {
      clearTimeout(timeout);
    };
  }, [loading]);

  return (
    <div className="fixed inset-x-0 top-0 z-50 h-1">
      <AnimatePresence>{showBar ? <ProgressBar /> : null}</AnimatePresence>
    </div>
  );
};

const Gutter = ({ children }: PropsWithChildren) => {
  return (
    <div className="flex w-full max-w-[1600px] flex-col gap-y-2 p-3">
      {children}
    </div>
  );
};

const Breadcrumbs = () => {
  const matches = useMatches() as unknown as UIMatch<
    unknown,
    {
      breadcrumb?: (match?: UIMatch) => string | ReactNode;
    }
  >[];

  const crumbs = matches
    .filter((match) => match.handle?.breadcrumb)
    .map((match) => {
      const handle = match.handle;
      let label: string | ReactNode | undefined = undefined;
      try {
        label = handle.breadcrumb?.(match);
      } catch (error) {
        // noop
      }
      if (!label) {
        return null;
      }
      return {
        label: label,
        path: match.pathname,
      };
    })
    .filter(Boolean) as { label: string | ReactNode; path: string }[];

  if (crumbs.length === 0) {
    return null;
  }

  return (
    <ol className={clx("text-ui-fg-muted txt-compact-small-plus flex select-none items-center")}>
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        const isSingle = crumbs.length === 1;

        return (
          <li key={index} className={clx("flex items-center")}>
            {!isLast ? (
              <Link className="transition-fg hover:text-ui-fg-subtle" to={crumb.path}>
                {crumb.label}
              </Link>
            ) : (
              <div>
                {!isSingle && <span className="block lg:hidden">...</span>}
                <span
                  key={index}
                  className={clx({
                    "hidden lg:block": !isSingle,
                  })}
                >
                  {crumb.label}
                </span>
              </div>
            )}
            {!isLast && (
              <span className="mx-2">
                <TriangleRightMini className="rtl:rotate-180" />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
};

const ToggleSidebar = () => {
  const { toggle } = useSidebar();

  return (
    <div>
      <IconButton
        className="hidden lg:flex"
        variant="transparent"
        onClick={() => toggle("desktop")}
        size="small"
      >
        <SidebarLeft className="text-ui-fg-muted rtl:rotate-180" />
      </IconButton>
      <IconButton
        className="hidden max-lg:flex"
        variant="transparent"
        onClick={() => toggle("mobile")}
        size="small"
      >
        <SidebarLeft className="text-ui-fg-muted rtl:rotate-180" />
      </IconButton>
    </div>
  );
};

const Topbar = () => {
  return (
    <div className="grid w-full grid-cols-2 border-b p-3">
      <div className="flex items-center gap-x-1.5">
        <ToggleSidebar />
        <Breadcrumbs />
      </div>
      <div className="flex items-center justify-end gap-x-3">
        {/* Notifications can go here */}
      </div>
    </div>
  );
};

const DesktopSidebarContainer = ({ children }: PropsWithChildren) => {
  const { desktop } = useSidebar();

  return (
    <div
      className={clx("hidden h-screen w-[220px] border-e", {
        "lg:flex": desktop,
      })}
    >
      {children}
    </div>
  );
};

const MobileSidebarContainer = ({ children }: PropsWithChildren) => {
  const { mobile, toggle } = useSidebar();

  return (
    <RadixDialog.Root open={mobile} onOpenChange={() => toggle("mobile")}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          className={clx(
            "bg-ui-bg-overlay fixed inset-0",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
        />
        <RadixDialog.Content
          className={clx(
            "bg-ui-bg-subtle shadow-elevation-modal fixed inset-y-2 start-2 flex w-full max-w-[304px] flex-col overflow-hidden rounded-lg border-r",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-start-1/2 data-[state=open]:slide-in-from-start-1/2 duration-200"
          )}
        >
          <div className="p-3">
            <RadixDialog.Close asChild>
              <IconButton size="small" variant="transparent" className="text-ui-fg-subtle">
                <XMark />
              </IconButton>
            </RadixDialog.Close>
          </div>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};
