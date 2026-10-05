"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    if (!token) {
      router.replace("/auth");
    } else {
      router.replace("/patient/overview");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#f4f7f6] flex items-center justify-center">
      <div className="animate-pulse text-xs font-bold text-teal-700">
        Loading Patient Portal...
      </div>
    </div>
  );
}
