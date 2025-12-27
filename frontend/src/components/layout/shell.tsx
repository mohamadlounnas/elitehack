import { PropsWithChildren } from "react";
import { Outlet, useNavigation } from "react-router-dom";
import { clx } from "@medusajs/ui";

export const Shell = ({ children }: PropsWithChildren) => {
  const navigation = useNavigation();
  const loading = navigation.state === "loading";

  return (
    <div className="relative flex h-screen flex-col items-start overflow-hidden lg:flex-row">
      <div className="flex h-screen w-full flex-col overflow-auto">
        <div className="grid w-full grid-cols-2 border-b p-3">
          <div className="flex items-center gap-x-1.5">
            {/* Breadcrumbs or title can go here */}
          </div>
        </div>
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

const Gutter = ({ children }: PropsWithChildren) => {
  return (
    <div className="flex w-full max-w-[1600px] flex-col gap-y-2 p-3">
      {children}
    </div>
  );
};
