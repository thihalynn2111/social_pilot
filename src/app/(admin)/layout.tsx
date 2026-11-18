import TabBar from "./TabBar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ph">
      <div className="scroll">{children}</div>
      <TabBar />
    </div>
  );
}
