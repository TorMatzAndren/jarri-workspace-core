import { WorkspaceShell } from "./shell/WorkspaceShell";
import { workspaceRuntime } from "./bootstrap/workspaceRuntime";
import { WorkspaceRuntimeProvider } from "./core/workspaceRuntimeReact";

export default function App() {
  return <WorkspaceRuntimeProvider runtime={workspaceRuntime}><WorkspaceShell /></WorkspaceRuntimeProvider>;
}

