import { RouterProvider } from "react-router";
import { router } from "./routes";

export default function App() {
  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <RouterProvider router={router} />
    </div>
  );
}
