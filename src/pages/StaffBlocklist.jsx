import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { rootminster } from '@/api/rootminsterClient';
import { AdminHeader, AdminPage } from '@/components/AdminPageShell';
import BlocklistManager from '@/components/BlocklistManager';

export default function StaffBlocklist() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    rootminster.auth.me().then(setCurrentUser).catch(() => setCurrentUser({}));
  }, []);

  return (
    <AdminPage>
      <AdminHeader
        eyebrow={currentUser?.role === 'admin' ? 'Administration' : 'Staff'}
        title="Blocklist"
        description="Block values from being used in subdomain requests and DNS records. Staff can add entries; only admins can remove them."
      />
      {currentUser
        ? <div className="max-w-2xl"><BlocklistManager currentUser={currentUser} /></div>
        : <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" /></div>}
    </AdminPage>
  );
}
