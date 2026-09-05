import { ConfigurationBackLink } from "@/components/dashboard/configuration-back-link";
import { JobRolesManager } from "@/components/job-roles/job-roles-manager";

export default function ConfigurationJobRolesPage() {
  return (
    <div className="min-h-full">
      <ConfigurationBackLink />
      <JobRolesManager />
    </div>
  );
}
