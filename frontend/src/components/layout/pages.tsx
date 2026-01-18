import { PropsWithChildren } from "react";
import { Outlet } from "react-router-dom";
import { clx } from "@medusajs/ui";

interface PageProps<TData = any> {
  children?: React.ReactNode;
  data?: TData;
  hasOutlet?: boolean;
}

export const SingleColumnPage = <TData,>({
  children,
  hasOutlet = true,
}: PageProps<TData>) => {
  return (
    <div className="flex flex-col gap-y-3">
      {children}
      {hasOutlet && <Outlet />}
    </div>
  );
};

interface TwoColumnPageProps<TData> extends PageProps<TData> {
  children: [React.ReactNode, React.ReactNode];
}

export const TwoColumnPage = <TData,>({
  children,
  hasOutlet = true,
}: TwoColumnPageProps<TData>) => {
  if (!Array.isArray(children) || children.length !== 2) {
    throw new Error("TwoColumnPage expects exactly two children");
  }

  const [main, sidebar] = children;

  return (
    <div className="flex w-full flex-col gap-y-3">
      <div className="flex w-full flex-col items-start gap-x-4 gap-y-3 xl:grid xl:grid-cols-[minmax(0,_1fr)_440px]">
        <div className="flex w-full min-w-0 flex-col gap-y-3">
          {main}
        </div>
        <div className="flex w-full flex-col gap-y-3 xl:mt-0">
          {sidebar}
        </div>
      </div>
      {hasOutlet && <Outlet />}
    </div>
  );
};

const Main = ({
  children,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) => {
  return (
    <div className={clx("flex w-full flex-col gap-y-3", className)} {...props}>
      {children}
    </div>
  );
};

const Sidebar = ({
  children,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) => {
  return (
    <div
      className={clx(
        "flex w-full max-w-[100%] flex-col gap-y-3 xl:mt-0 xl:max-w-[440px]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

TwoColumnPage.Main = Main;
TwoColumnPage.Sidebar = Sidebar;



