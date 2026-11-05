import { useAuth } from '../context/AuthContext';
import { Mail, ShieldCheck, UserRound } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuth();
  const initials = (user?.fullName || user?.email || 'B')
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

  return (
    <div className="page-box">
      <div className="page-header">
        <div>
          <p className="eyebrow">Account</p>
          <h2>Profile</h2>
        </div>
      </div>
      <section className="card profile-card">
        <div className="profile-identity">
          <span className="profile-avatar">{initials || <UserRound size={25} />}</span>
          <div><p className="eyebrow">BillFlow account</p><h3>{user?.fullName || 'User'}</h3><span>Profile details</span></div>
        </div>
        <div className="profile-detail-list">
          <div><span className="profile-detail-icon"><Mail size={17} /></span><span><small>Email address</small><strong>{user?.email || 'Not available'}</strong></span></div>
          <div><span className="profile-detail-icon"><ShieldCheck size={17} /></span><span><small>Account role</small><strong>{String(user?.role || 'business user').replaceAll('_', ' ')}</strong></span></div>
        </div>
        <p className="profile-security-note">Your account is protected by secure sign-in. Contact your business administrator if your account details need to be updated.</p>
      </section>
    </div>
  );
}
