export default function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={`empty-state ${className}`.trim()}>
      {Icon && <span className="empty-state-icon"><Icon size={21} strokeWidth={1.8} /></span>}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
