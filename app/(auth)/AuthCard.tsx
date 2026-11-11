export default function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-6 sm:p-8">
      <h1 className="mb-5 text-lg font-semibold text-gray-900">{title}</h1>
      {children}
    </div>
  );
}
