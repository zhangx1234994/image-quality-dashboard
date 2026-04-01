import { createBrowserRouter } from "react-router";
import { ListPage } from "./pages/ListPage";
import { ComparePage } from "./pages/ComparePage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: ListPage,
  },
  {
    path: "/compare/:id",
    Component: ComparePage,
  },
]);
