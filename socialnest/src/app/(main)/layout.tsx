import { validateRequest } from "@/auth";
import { redirect } from "next/navigation";
import { ReactNode, useContext } from "react";
import SessionProvider from "./SessionProvider";
import Navbar from "./Navbar";

export default async function Layout({ children }: { children: ReactNode }) {
  const session = await validateRequest();

  if (!session.user) redirect("/login");

  return (
    <SessionProvider value={session}>
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <div className="mx-auto max-w-7xl p-5">{children}</div>
      </div>
    </SessionProvider>
  );
}
