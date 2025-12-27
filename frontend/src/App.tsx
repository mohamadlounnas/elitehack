import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { Providers } from "./providers/providers";
import { SidebarProvider } from "./providers/sidebar-provider/sidebar-provider";
import { Shell } from "./components/layout/shell";
import { ProjectsList } from "./pages/ProjectsList";
import { ProjectPage } from "./pages/ProjectPage";

const RouterLayout = () => {
  return (
    <SidebarProvider>
      <Shell />
    </SidebarProvider>
  );
};

const router = createBrowserRouter([
  {
    path: "/",
    element: <RouterLayout />,
    handle: {
      breadcrumb: () => "Home",
    },
    children: [
      {
        index: true,
        element: <Navigate to="/projects" replace />,
      },
      {
        path: "projects",
        element: <ProjectsList />,
        handle: {
          breadcrumb: () => "Projects",
        },
      },
      {
        path: "projects/:id",
        element: <ProjectPage />,
        handle: {
          breadcrumb: () => "Project",
        },
      },
    ],
  },
]);

function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}

export default App;
