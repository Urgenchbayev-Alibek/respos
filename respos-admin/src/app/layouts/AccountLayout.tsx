import { WorkspaceLayout } from './WorkspaceLayout/WorkspaceLayout';

/** Signed-in pages outside a workspace (profile). Reachable for every role. */
export function AccountLayout() {
  return <WorkspaceLayout showBranch={false} />;
}
