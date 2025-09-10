import FloatingNav from "../components/FloatingNav";

export default function TestLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FloatingNav />
      {children}
    </>
  );
}
