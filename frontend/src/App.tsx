import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { Providers } from "./providers/providers";
import { Shell } from "./components/layout/shell";
import { ProjectsList } from "./pages/ProjectsList";
import { ProjectPage } from "./pages/ProjectPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Shell />,
    children: [
      {
        index: true,
        element: <Navigate to="/projects" replace />,
      },
      {
        path: "projects",
        element: <ProjectsList />,
      },
      {
        path: "projects/:id",
        element: <ProjectPage />,
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
