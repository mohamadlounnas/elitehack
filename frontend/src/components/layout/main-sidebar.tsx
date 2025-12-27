import { Buildings, Plus } from "@medusajs/icons";
import { Divider, Text, Button, clx } from "@medusajs/ui";
import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import { CreateProjectDrawer } from "./create-project-drawer";

export const MainSidebar = () => {
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);

  return (
    <>
      <aside className="flex flex-1 flex-col justify-between overflow-y-auto">
        <div className="flex flex-1 flex-col">
          <div className="bg-ui-bg-subtle sticky top-0">
            <Header />
            <div className="px-3">
              <Divider variant="dashed" />
            </div>
          </div>
          <div className="flex flex-1 flex-col justify-between">
            <div className="flex flex-1 flex-col">
              <CoreRouteSection />
            </div>
            <div className="p-3 border-t">
              <Button
                variant="secondary"
                size="small"
                className="w-full"
                onClick={() => setShowCreateDrawer(true)}
              >
                <Plus />
                Create Project
              </Button>
            </div>
          </div>
        </div>
      </aside>
      <CreateProjectDrawer open={showCreateDrawer} onOpenChange={setShowCreateDrawer} />
    </>
  );
};

const Header = () => {
  return (
    <div className="w-full p-3">
      <div className="bg-ui-bg-subtle transition-fg grid w-full grid-cols-[24px_1fr] items-center gap-x-3 rounded-md p-0.5 pe-2">
        <div className="flex size-6 items-center justify-center">
          <Buildings className="text-ui-fg-subtle" />
        </div>
        <div className="block overflow-hidden text-start">
          <Text size="small" weight="plus" leading="compact" className="truncate">
            Factory Planning
          </Text>
        </div>
      </div>
    </div>
  );
};

const CoreRouteSection = () => {
  const location = useLocation();

  const routes = [
    {
      icon: <Buildings />,
      label: "Projects",
      to: "/projects",
    },
  ];

  return (
    <nav className="flex flex-col gap-y-1 py-3">
      {routes.map((route) => {
        const isActive = location.pathname.startsWith(route.to);
        return (
          <div key={route.to} className="px-3">
            <NavLink
              to={route.to}
              className={clx(
                "text-ui-fg-subtle transition-fg hover:bg-ui-bg-subtle-hover flex items-center gap-x-2 rounded-md py-0.5 pl-0.5 pr-2 outline-none [&>svg]:text-ui-fg-subtle focus-visible:shadow-borders-focus",
                {
                  "bg-ui-bg-base shadow-elevation-card-rest text-ui-fg-base hover:bg-ui-bg-base": isActive,
                }
              )}
            >
              <div className="flex size-6 items-center justify-center">{route.icon}</div>
              <Text size="small" weight="plus" leading="compact">
                {route.label}
              </Text>
            </NavLink>
          </div>
        );
      })}
    </nav>
  );
};

